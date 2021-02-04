import { sparqlEscape } from 'mu';
import { authenticatedQuery, query } from '../util/database';
import { DEBUG_LOGS, SEMANTIC_FORM_TYPE } from '../../env';
import { SemanticForm, SUBMISSION_STATUSES } from '../entities/semantic-form';
import { NTriplesMutator } from './n-triples-mutator';
import { Model } from '../model-mapper/entities/model';
import { ModelMapper } from '../model-mapper/model-mapper';
import { FORM, Graph, parse, RDF, RDFNode } from '../util/rdflib';
import { validateForm } from '@lblod/submission-form-helpers';
import { SemanticFormBundle } from '../entities/semantic-form-bundle';
import { META_FILE_MATCHER } from './meta-files';
import { SourceDataExtractor } from './source-data-extractor';
import { CONFIG_FILE_MATCHER, SPEC_FILE_MATCHER } from './configurationFiles';

/**
 * Service providing all management logic/services for semantic-forms.
 */
export class SemanticFormManagement {

  constructor(config_files, meta_files) {
    this.config_files = config_files;
    this.meta_files = meta_files;

    // NOTE: by default the mutator does SUDO queries.
    this.mutator = new NTriplesMutator({sudo: true});
  }

  /**
   * Returns a {@link SemanticForm} for the given UUID.
   *
   * [CONSIDERED AUTH. SAFE]
   *
   * @param uuid
   *
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
        message: `You do not have access to OR we could not retrieve the semantic-form.`,
      };
    }
  }

  /**
   * Returns the {@link SemanticFormBundle} for the given UUID.
   *
   * [CONSIDERED AUTH. SAFE]
   *
   * @param uuid
   */
  async getSemanticFormBundle(uuid) {
    const form = await this.getSemanticForm(uuid);
    if (!form.sources.length) {
      // NOTE: in-case no sources were set yet (new semantic-form)
      form.sources.push(this.config_files.specification);
      form.sources.push(this.config_files.config);
      form.sources.push(this.meta_files.latest);

      /**
       * NOTE: we don't wait here because there is a high probability that if this fails:
       *        1) it was because the database was down,
       *        2) it will recover when trying to retrieve the form again,
       */
      try {
        this.updateSemanticForm(uuid, form);
      } catch (e) {
        console.error(`Failed updating sources for semantic-form with ${uuid}`);
        console.error(e);
      }

      /**
       * NOTE: we expect that at this point sources have been set on the semantic-form
       */
      const bundle = new SemanticFormBundle();
      const definition = form.getSource(CONFIG_FILE_MATCHER).content['resource'];
      bundle.source = await new SourceDataExtractor().extract(form.uri, definition);
      bundle.specification = form.getSource(SPEC_FILE_MATCHER);
      // TODO: add some post-processing on the meta-data to enforce business logic.
      bundle.meta = form.getSource(META_FILE_MATCHER);
      return {form, bundle};
    }
  }

  /**
   * Deletes {@link SemanticForm} with provided UUID.
   *
   * [CONSIDERED AUTH. SAFE]
   *
   * @param uuid
   *
   * @returns {Promise<void>}
   */
  async deleteSemanticForm(uuid) {
    const {form, bundle} = await this.getSemanticFormBundle(uuid);
    blockMutationsReadOnly(form, 'Could not delete the semantic-form as it has already been submitted.');
    await this.mutator.delete(form.graph, bundle.source.content);
    await this.mutator.delete(form.graph, form.toNT());
  }

  /**
   * Updates {@link SemanticForm} with provided UUID.
   *
   * @param uuid
   * @param delta = {additions, removals} | {@link SemanticForm}
   *
   * @returns {Promise<void>}
   */
  async updateSemanticForm(uuid, delta) {
    const old = await this.getSemanticForm(uuid);
    blockMutationsReadOnly(old, 'Could not update the semantic-form as it has already been submitted.');
    if (delta instanceof SemanticForm) {
      delta = {
        removals: old.toNT(),
        additions: delta.toNT(),
      };
    }
    await this.mutator.update(old.graph, delta);
  }

  /**
   * Submit the {@link SemanticForm} for the given UUID.
   *
   * Submitting a {@link SemanticForm} means:
   *  1) validating the form
   *  2) mapping to the clean model
   *  3) updating status to {@link SUBMISSION_STATUSES.sent}
   *
   * @param uuid
   *
   * @returns {Promise<void>}
   */
  async submitSemanticForm(uuid) {
    const {form, bundle} = await this.getSemanticFormBundle(uuid);
    blockMutationsReadOnly(form, 'Could not submit the semantic-form as it has already been submitted.');

    if (isValid(form, bundle)) {
      // NOTE: model-mapping
      let {prefixes, resource_definitions, mapping} = this.config_files.mapper.content;
      const model = new Model(resource_definitions, prefixes);
      await new ModelMapper(model).map(form.uri, mapping);
      await this.mutator.insert(form.graph, model.toNT());

      // NOTE: if only when "post-processing" was successfully, we update the state to "submitted"
      form.status = SUBMISSION_STATUSES.sent;
      await this.updateSemanticForm(uuid, form);
    } else {
      throw {
        status: 422,
        resource: {
          uuid: uuid,
        },
        message: `Could not submit the semantic-form, validation failed.`,
      };
    }
  }

}

/* PRIVATE FUNCTIONS */

/**
 * Simple "blocker" function that throws an error when the {@link SemanticForm} is read-only
 *
 * TODO: is their a better way to do this?
 *
 * @param form - {@link SemanticForm}
 * @param message
 */
function blockMutationsReadOnly(form, message) {
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
 * Returns based on given {@link SemanticForm} and {@link SemanticFormBundle} if it is valid.
 *
 * NOTE: Wrapper around the {@link validateForm} function provided by {@link @lblod/submission-form-helpers}`
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
  parse(specification.content, store, {graph: options.formGraph});
  parse(source.content, store, {graph: options.sourceGraph});
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