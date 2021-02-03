import { sparqlEscape } from 'mu';
import { authenticatedQuery, query } from '../util/database';
import { DEBUG_LOGS, SEMANTIC_FORM_TYPE } from '../../env';
import { SemanticForm, SUBMISSION_STATUSES } from '../entities/semantic-form';
import { NTriplesMutationService } from './n-triples-mutation-service';
import { Model } from '../model-mapper/entities/model';
import { ModelMapper } from '../model-mapper/model-mapper';
import { FORM, Graph, parse, RDF, RDFNode } from '../util/rdflib';
import { validateForm } from '@lblod/submission-form-helpers';

/**
 * Service providing all business logic for semantic-forms
 */
export class SemanticFormService {

  constructor(config, meta) {
    this.config = config;
    this.meta = meta;
    this.mutationService = new NTriplesMutationService({sudo: true});
  }

  /**
   * Returns a SemanticForm POJO for the given UUID.
   *
   * CONSIDERED AUTHORIZATION SAFE
   *
   * @param uuid
   * @returns {Promise<SemanticForm>}
   */
  async getFormPOJO(uuid) {
    const forms = await getFormPOJOinStore(uuid);
    if (forms.length) {
      if (forms.length > 1) {
        /**
         * NOTE: build in the case off the small change that multiple forms are found for the same UUID.
         *       As this has a small chance off happening a silent warning is thrown.
         */
        console.warn(`Multiple results where found for semantic-form with UUID <${uuid}>.\n Data could be corrupted?`);
      }
      const form = forms[0];
      form.sources = await getSourcesInStore(form);
      return form;
    } else {
      /**
       *  NOTE: at the time off impl. we are unable to differentiate between 401 <> 404
       */
      throw {
        status: 400,
        resource: {
          uuid: uuid,
        },
        message: `Could not access or retrieve the semantic-form.`,
      };
    }
  }

  /**
   *
   * @param uuid
   * @param updated
   * @returns {Promise<void>}
   */
  async updateFormPOJO(uuid, updated) {
    const old = await this.getFormPOJO(uuid);
    try {
      await this.mutationService.update(old.graph, {
        removals: old.toNT(),
        additions: updated.toNT(),
      });
    } catch (e) {
      console.error(e);
      throw {
        status: 500,
        resource: {
          uuid: uuid,
        },
        message: `Something unexpected went wrong while trying to update the semantic-form.`,
      };
    }
  }

  /**
   * Returns all form-data for the given UUID.
   *
   * "form-data" includes everything we need to "render" a form. This includes
   *  - source: the data harvested from the store (user-input)
   *  - form: the configuration off the form
   *  - meta: meta(extra)-data harvested from the store required to render the form
   *
   * CONSIDERED AUTHORIZATION SAFE
   *
   * @param uuid
   * @returns {Promise<{ resource: SemanticForm, form: "n-triples" , meta: "n-triples", source: "n-triples"}>}
   */
  async getFormData(uuid) {
    const resource = await this.getFormPOJO(uuid);

    try {
      let config_file = this.config.CONFIG_FILE;
      let form_file = this.config.FORM_FILE;
      let meta_file = this.meta.META_FILE;

      if (resource.sources.length) {
        if (DEBUG_LOGS) {
          console.warn('Source files where found for semantic-form');
        }
        config_file = resource.sources.find(file => file.filename.includes('config.json'));
        form_file = resource.sources.find(file => file.filename.includes('form.ttl'));
        meta_file = resource.sources.find(file => file.filename.includes('-meta.ttl'));
      }

      /**
       * NOTE: process user defined source
       *
       * TODO:  in the future this should be replaced with a function that will construct the source-data
       *        based on the `sh:path`'s defined in the linked form configuration.
       */
      let harvest = config_file.content['resource'];
      harvest['node'] = {value: resource.uri};
      // TODO mutation service shouldn't be responsible for this, move this to a 'source-gen-service'
      const source = await this.mutationService.generate(harvest);

      const form = form_file.content;

      // TODO: some user specific business logic (remove reeksen that have been submitted)
      const meta = meta_file.content;

      return {
        resource,
        source,
        form,
        meta,
      };
    } catch (e) {
      console.log(e);
      throw {
        status: 500,
        resource: {
          uuid: uuid,
        },
        message: `Something unexpected went wrong while trying to retrieve the form-data for the semantic-form resource.`,
      };
    }
  }

  /**
   * Deletes ALL SOURCE-data for the SemanticForm with provided UUID.
   *
   * @param uuid
   * @returns {Promise<void>}
   */
  async deleteFormData(uuid) {
    // NOTE: we use `getSemanticFormNTriplesFor` to ensure all date is deleted
    // TODO not reliable
    const form_data = await this.getFormData(uuid);
    blockMutationsIfSubmitted(form_data.resource,
        'Could not update the semantic-form as it has already been submitted.');
    try {
      await this.mutationService.delete(form_data.resource.graph, form_data.source);
    } catch (e) {
      console.error(e);
      throw {
        status: 500,
        resource: {
          uuid: uuid,
        },
        message: `Something unexpected went wrong while trying to delete the form-data for the given semantic-form resource.`,
      };
    }
  }

  /**
   * Updates given delta for the SemanticForm with provided UUID.
   *
   * @param uuid
   * @param delta = {additions: "n-triples", removals: "n-triples" }
   * @returns {Promise<void>}
   */
  async updateFormData(uuid, delta) {
    const form = await this.getFormPOJO(uuid);
    blockMutationsIfSubmitted(form, 'Could not update the semantic-form as it has already been submitted.');
    try {
      await this.mutationService.update(form.graph, delta);
    } catch (e) {
      console.warn(e);
      throw {
        status: 500,
        resource: {
          uuid: uuid,
        },
        message: `Something unexpected went wrong while trying to update the form-data for the given semantic-form resource.`,
      };
    }
  }

  /**
   * Submit the SemanticForm for the given UUID.
   *
   * Submission can fail if:
   *  - no authorization
   *  - already submitted
   *  - not valid (validation)
   *  - mapping to clean model fails
   *
   * @param uuid
   * @returns {Promise<void>}
   */
  async submitSemanticForm(uuid) {
    const form_data = await this.getFormData(uuid);
    blockMutationsIfSubmitted(form_data.resource,
        'Could not submit the semantic-form as it has already been submitted.');

    if (isValid(form_data)) {
      try {

        // NOTE: save used configuration
        form_data.resource.sources.push(this.config.FORM_FILE);
        form_data.resource.sources.push(this.config.CONFIG_FILE);
        form_data.resource.sources.push(this.meta.META_FILE);

        await this.updateFormPOJO(uuid, form_data.resource);

        // NOTE: model-mapping
        let {prefixes, resource_definitions, mapping} = this.config.MAPPER_FILE.content;
        const model = new Model(resource_definitions, prefixes);
        await new ModelMapper(model).map(form_data.resource.uri, mapping);
        await this.mutationService.insert(form_data.resource.graph, model.toNT());

        // NOTE: if only when "post-processing" was successfully, we update the state to "submitted"
        form_data.resource.status = SUBMISSION_STATUSES.sent;

        await this.updateFormPOJO(uuid, form_data.resource);
      } catch (e) {
        console.warn(e);
        throw {
          status: 500,
          resource: {
            uuid: uuid,
          },
          message: `Something unexpected went wrong while trying to update the semantic-form.`,
        };
      }
    } else {
      throw {
        status: 422,
        resource: {
          uuid: uuid,
        },
        message: `Could not submit the semantic-form as not all validation-conditions were met.`,
      };
    }
  }

}

/* PRIVATE FUNCTIONS */

/**
 * Simple "blocker" function that throws an error when the form was submitted
 *
 * TODO is their a better way to do this?
 *
 * @param formPOJO
 * @param message
 */
function blockMutationsIfSubmitted(formPOJO, message) {
  if (formPOJO.submitted) {
    throw {
      status: 304,
      resource: {
        uuid: uuid,
      },
      message,
    };
  }
}

/**
 * Returns based on given form-data if a form is considered to be valid.
 *
 * Wrapper around the {@link validateForm} function provided by `'@lblod/submission-form-helpers'`
 *
 * @param resource
 * @param source
 * @param form
 * @returns boolean
 */
function isValid({resource, source, form}) {
  const store = new Graph();
  const options = {
    formGraph: 'http://form-graph',
    sourceGraph: 'http://source-graph',
    sourceNode: RDFNode(resource.uri),
    store,
  };
  parse(form, store, {graph: options.formGraph});
  parse(source, store, {graph: options.sourceGraph});
  const form_statements = store.any(undefined, RDF('type'), FORM('Form'), RDFNode('http://form-graph'));
  return validateForm(form_statements, options);
}

async function getFormPOJOinStore(uuid) {
  let response;
  try {
    response = await authenticatedQuery(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX adms: <http://www.w3.org/ns/adms#>
PREFIX terms: <http://purl.org/dc/terms/>

SELECT ?graph ?uri ?status
WHERE {
    GRAPH ?graph {
        ?uri mu:uuid ${sparqlEscape(uuid, 'string')} ;
             rdf:type <${SEMANTIC_FORM_TYPE}> ;
             adms:status ?status .
    }
}`);
  } catch (e) {
    if (DEBUG_LOGS) {
      console.error(e);
    }
    throw {
      status: 500,
      resource: {
        uuid: uuid,
      },
      message: `Something unexpected went wrong while trying to retrieve the semantic-form.`,
    };
  }
  return response.results.bindings.map(binding => new SemanticForm({
    graph: binding.graph.value,
    uri: binding.uri.value,
    uuid,
    status: binding.status.value,
  }));
}

async function getSourcesInStore(formPOJO) {
  let response;
  try {
    response = await query(`
PREFIX terms: <http://purl.org/dc/terms/>
SELECT ?source
WHERE {
    GRAPH ?graph {
        <${formPOJO.uri}> terms:source ?source .
    }
}`, true);
  } catch (e) {
    if (DEBUG_LOGS) {
      console.error(e);
    }
    throw {
      status: 500,
      resource: {
        form: formPOJO,
      },
      message: `Something unexpected went wrong while trying to retrieve the sources for form.`,
    };
  }
  return response.results.bindings.map(binding => binding.source.value);
}