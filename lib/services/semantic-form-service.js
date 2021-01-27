import { sparqlEscape } from 'mu';
import { authenticatedQuery } from '../util/database';
import { DEFAULT_CONFIG, SEMANTIC_FORM_TYPE } from '../../env';
import { SemanticForm, SUBMISSION_STATUSES } from '../entities/semantic-form';
import { NTriplesMutationService } from './n-triples-mutation-service';
import { getFileContent, uriToPath } from '../util/file';
import { Model } from '../model-mapper/entities/model';
import { ModelMapper } from '../model-mapper/model-mapper';
import { FORM, Graph, parse, RDF, RDFNode } from '../util/rdflib';
import { validateForm } from '@lblod/submission-form-helpers';

/**
 * Service providing all business logic for semantic-forms
 */
export class SemanticFormService {

  constructor(versionService) {
    this.versionService = versionService;
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
    let response;
    try {
      response = await authenticatedQuery(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX adms: <http://www.w3.org/ns/adms#>
PREFIX terms: <http://purl.org/dc/terms/>

SELECT ?graph ?uri ?status ?source
WHERE {
    GRAPH ?graph {
        ?uri mu:uuid ${sparqlEscape(uuid, 'string')} ;
             rdf:type <${SEMANTIC_FORM_TYPE}> ;
             adms:status ?status .
        OPTIONAL { ?uri terms:source ?source . }
    }
}`);
    } catch (e) {
      console.warn(e);
      throw {
        status: 500,
        resource: {
          uuid: uuid,
        },
        message: `Something unexpected went wrong while trying to retrieve the semantic-form.`,
      };
    }
    if (response) {
      const bindings = response.results.bindings;
      if (bindings.length > 1) {
        /**
         * NOTE: build in the case off the small change that multiple forms are found for the same UUID.
         *       As this has a small chance off happening a silent warning is thrown.
         */
        console.warn(`Multiple results where found for semantic-form with UUID <${uuid}>.\n Data could be corrupted?`);
      }
      const binding = bindings[0];
      let formPOJO = new SemanticForm({
        graph: binding.graph.value,
        uri: binding.uri.value,
        uuid,
        status: binding.status.value,
      });

      // NOTE: conditional values
      if (binding.source) {
        formPOJO.source = binding.source.value;
      }

      return formPOJO;
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
      console.exception(e);
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
      /**
       * NOTE: if the source/form-data was not found, we set the current active form-data directory
       * TODO is this the right place?
       */
      if (!resource.source) {
        resource.source = this.versionService.active.uri;
        this.updateFormPOJO(uuid, resource); // NOTE: no need to wait
      }

      // NOTE: first process default required fields to create a semantic-form
      let mapping = DEFAULT_CONFIG.resource;
      mapping['node'] = {value: resource.uri};
      let source = await this.mutationService.generate(mapping);

      /**
       * NOTE: process user defined source
       *
       * TODO:
       * in the future this should be replaced with a function that will construct the source-data
       * based on the `sh:path`'s defined in the linked form configuration.
       */
      mapping = require(uriToPath(`${resource.source}/config.json`))['resource'];
      mapping['node'] = {value: resource.uri};

      source += await this.mutationService.generate(mapping);

      const form = await getFileContent(`${resource.source}/form.ttl`);
      const meta = await getFileContent(`${resource.source}/meta.ttl`);

      return {
        resource,
        source,
        form,
        meta,
      };
    } catch (e) {
      console.exception(e);
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
    const form_data = await this.getFormData(uuid);
    blockMutationsIfSubmitted(form_data.resource,
        'Could not update the semantic-form as it has already been submitted.');
    try {
      await this.mutationService.update(form_data.resource.graph, form_data.source);
    } catch (e) {
      console.exception(e);
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
        // NOTE: model-mapping
        // TODO should not come from the versioning
        let {prefixes, resource_definitions, mapping} = require(uriToPath(`${form_data.resource.source}/mapper.js`));
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
 * Returns based on given form-data if a form is conciderd to be valid.
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
  const form_statements = this.graph.any(undefined, RDF('type'), FORM('Form'), RDFNode('http://form-graph'));
  return validateForm(form_statements, options);
}