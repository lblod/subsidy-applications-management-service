import { sparqlEscape } from 'mu';
import { authenticatedQuery, query } from '../util/database';
import { DEBUG_LOGS, SEMANTIC_FORM_TYPE } from '../../env';
import { SemanticForm, SUBMISSION_STATUSES } from '../entities/semantic-form';
import { NTriplesMutation } from './n-triples-mutation';
import { Model } from '../model-mapper/entities/model';
import { ModelMapper } from '../model-mapper/model-mapper';
import { FORM, Graph, parse, RDF, RDFNode } from '../util/rdflib';
import { validateForm } from '@lblod/submission-form-helpers';
import { SemanticFormBundle } from '../entities/semantic-form-bundle';
import { META_FILE_MATCHER } from './meta-data';
import { SourceDataGeneration } from './source-data-generation';
import { CONFIG_FILE_MATCHER, SPEC_FILE_MATCHER } from './configuration';

/**
 * Service providing all business logic for semantic-forms
 */
export class SemanticFormManagement {

  constructor(config_files, meta) {
    this.config_files = config_files;
    this.meta = meta;
    this.source = new SourceDataGeneration(this.config_files);
    this.mutationService = new NTriplesMutation({sudo: true});
  }

  /**
   * Returns a SemanticForm for the given UUID.
   *
   * CONSIDERED AUTHORIZATION SAFE
   *
   * @param uuid
   * @returns {Promise<SemanticForm>}
   */
  async getSemanticForm(uuid) {
    const forms = await getSemanticFormsInStore(uuid);
    if (forms.length) {
      if (forms.length > 1) {
        /**
         * NOTE: build in the case off the small change that multiple forms are found for the same UUID.
         *       As this has a small chance off happening a silent warning is thrown.
         */
        console.warn(`Multiple results where found for semantic-form with UUID <${uuid}>.\n Data could be corrupted?`);
      }

      const form = forms[0];

      // NOTE: in-case sources did exist
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
   */
  async getSemanticFormBundle(uuid) {
    const form = await this.getSemanticForm(uuid);
    try {

      if(!form.sources.length) {
        // NOTE: in-case no sources were set yet (new semantic-form)
        form.sources.push(this.config_files.specification);
        form.sources.push(this.config_files.config);
        form.sources.push(this.meta.latest);

        // NOTE: no need to wait
        this.updateSemanticForm(uuid, form);
      }

      /**
       * NOTE: we expect that at this point sources have been set on the semantic-form
       */
      const bundle = new SemanticFormBundle();
      bundle.source = await this.source.generate(form.uri, form.getSource(CONFIG_FILE_MATCHER).content['resource'])
      bundle.specification = form.getSource(SPEC_FILE_MATCHER);
      // TODO: add some post-processing on the meta-data to enforce business logic.
      bundle.meta = form.getSource(META_FILE_MATCHER);
      return {form, bundle};

    } catch (e) {
      console.log(e);
      throw {
        status: 500,
        resource: {
          uuid: uuid,
        },
        message: `Something unexpected went wrong while trying to retrieve the bundle for the semantic-form resource.`,
      };
    }
  }

  /**
   * Deletes ALL SOURCE-data for the SemanticForm with provided UUID.
   *
   * @param uuid
   * @returns {Promise<void>}
   */
  async deleteSemanticForm(uuid) {
    const {form, bundle} = await this.getSemanticFormBundle(uuid);
    blockMutationsIfSubmitted(form, 'Could not delete the semantic-form as it has already been submitted.');
    try {
      await this.mutationService.delete(form.graph, bundle.source.content);
      await this.mutationService.delete(form.graph, form.toNT());
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
  async updateSemanticForm(uuid, delta) {
    const old = await this.getSemanticForm(uuid);
    blockMutationsIfSubmitted(old, 'Could not update the semantic-form as it has already been submitted.');
    try {
      if (delta instanceof SemanticForm) {
        delta = {
          removals: old.toNT(),
          additions: delta.toNT(),
        };
      }
      await this.mutationService.update(old.graph, delta);
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
    const {form, bundle} = await this.getSemanticFormBundle(uuid);
    blockMutationsIfSubmitted(form, 'Could not submit the semantic-form as it has already been submitted.');

    if (isValid(form, bundle)) {
      try {

        // NOTE: model-mapping
        let {prefixes, resource_definitions, mapping} = this.config_files.mapper.content;
        const model = new Model(resource_definitions, prefixes);
        await new ModelMapper(model).map(form.uri, mapping);
        await this.mutationService.insert(form.graph, model.toNT());

        // NOTE: if only when "post-processing" was successfully, we update the state to "submitted"

        form.status = SUBMISSION_STATUSES.sent;
        await this.updateSemanticForm(uuid, form);

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
 * @param form
 * @param message
 */
function blockMutationsIfSubmitted(form, message) {
  if (form.submitted) {
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
 */
function isValid(form, {source, specification}) {
  const store = new Graph();
  const options = {
    formGraph: 'http://form-graph',
    sourceGraph: 'http://source-graph',
    sourceNode: RDFNode(form.uri),
    store,
  };
  parse(specification, store, {graph: options.formGraph});
  parse(source, store, {graph: options.sourceGraph});
  const form_statements = store.any(undefined, RDF('type'), FORM('Form'), RDFNode('http://form-graph'));
  return validateForm(form_statements, options);
}

async function getSemanticFormsInStore(uuid) {
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