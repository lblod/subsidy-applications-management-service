import {sparqlEscape, uuid as uuidv4} from 'mu';
import {authenticatedQuery, query} from '../util/database';
import {
  DEBUG_LOGS,
  SEMANTIC_FORM_TYPE,
  TAILORED_META_DATA_ROOT,
} from '../../env';
import {SemanticForm, SEMANTIC_FORM_STATUS} from '../entities/semantic-form';
import {COMMON_GRAPHS, NTriplesMutator} from './n-triples-mutator';
import {FORM, Graph, parse, RDF, RDFNode} from '../util/rdflib';
import {validateForm} from '@lblod/submission-form-helpers';
import {SemanticFormBundle} from '../entities/semantic-form-bundle';
import {SourceDataExtractor} from './source-data-extractor';
import {TailoredMetaDataExtractor} from './tailored-meta-data-extractor';
import {SemanticFile} from '../entities/semantic-file';
import {mkDirIfNotExistsSync} from '../util/file';
import {TAILORED_META_FILE_MATCHER} from '../entities/semantic-form-meta';

/**
 * Service providing all management logic/services for semantic-forms.
 */
export class SemanticFormManagement {

  constructor(configuration) {
    this.configuration = configuration;

    /**
     * NOTE:  by default the mutator does SUDO queries as the form model is considered to be *"dirty".
     *        *"dirty" means: possibly no types nor uuid's
     */
    this.mutator = new NTriplesMutator({sudo: true});

    /**
     * NOTE: linked to tailored meta-data, dir. were it will we dropped
     */
    mkDirIfNotExistsSync(TAILORED_META_DATA_ROOT);
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
  async getSemanticForm(uuid, {sudo = false} = {}) {
    const forms = await getSemanticFormsInStore(uuid, {sudo});
    if (forms.length) {
      if (forms.length > 1) {
        /**
         * NOTE: build in the case of the small change that multiple forms are found for the same UUID.
         *       As this has a small chance of happening a silent warning is thrown.
         */
        console.warn(
            `Multiple results where found for semantic-form with UUID <${uuid}>.\n Data could be corrupted?`);
      }

      const form = forms[0];

      // NOTE: in-case sources did exist
      form.sources = await getSourcesInStore(form);

      return form;
    } else {
      /**
       *  NOTE: at the time of impl. we are unable to differentiate between 401 <> 404
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
   * Enriches a semantic-form with the latest, needed sources
   * - specification TLL
   * - specification JSON
   * - meta
   * - tailored
   *
   * @param form
   * @returns {Promise<void>}
   */
  async enrichSemanticForm(form) {
    const uuid = form.uuid;

    let sources = {};
    try {
      sources = await this.configuration.sources.getLatest(
          form.bundle.specification.turtle.uri);
    } catch (error) {
      throw {
        status: 404,
        resource: {
          uuid,
        },
        message: `Could not retrieve/find form configuration for semantic-form """${uuid}"""`,
      };
    }

    let {configuration, meta} = sources;

    form.sources = [
      configuration.specification.turtle,
      configuration.specification.json,
    ];
    if (meta)
      form.sources.push(meta);

    /**
     * NOTE: generate and save tailored TTL if is has been configured.
     */
    if (configuration.tailored.meta) {
      const extractors = configuration.tailored.meta.content;
      const {additions} = await new TailoredMetaDataExtractor(form).execute(
          extractors);

      /**
       * NOTE: if additions were found, we create a unique file that contains this meta-data
       */
      if (additions) {
        const filename = `${TAILORED_META_DATA_ROOT}${uuidv4()}${TAILORED_META_FILE_MATCHER.additions}`;
        const file = new SemanticFile({filename});
        SemanticFile.write(file, additions);
        form.sources.push(file); // NOTE: linking it to the semantic-form

        try {
          await this.mutator.insert(file.toNT(), form.graph);
        } catch (e) {
          console.warn(
              `Failed saving extracted tailored meta-data for ${uuid}`);
          console.log(e);
          // NOTE: try to clean-up dangling file
          SemanticFile.unlink(file);
        }
      }
    }

    /**
     * NOTE: generate and save tailored source TTL if is has been configured.
     */
    if (configuration && configuration.tailored.source) {

      // NOTE: clean-up old, and possibly broken source-data
      try {
        const deprecated =
            await new SourceDataExtractor().extract(
                form.uri,
                form.bundle.specification.definition);
        await this.mutator.delete(deprecated, form.graph);
      } catch (e) {
        // it's ok if this fails.
      }

      const extractors = configuration.tailored.source.content;
      const {additions} =
          await new TailoredMetaDataExtractor(form).execute(extractors);
      if (additions) {
        try {
          await this.mutator.insert(additions, form.graph);
        } catch (e) {
          console.warn(
              `Failed saving extracted start (source) data for ${uuid}`);
          console.log(e);
        }
      }
    }

    // SAVE
    try {
      await this.updateSemanticForm(uuid, form);
    } catch (e) {
      console.warn(`Failed updating sources for semantic-form with ${uuid}`);
      console.log(e);
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

    /**
     * NOTE: we enrich the form when we assume it to be new or incomplete :
     * - the status is NEW
     * - only one source is set, we assume this to be the form.ttl
     *
     * TODO: make this a little more type safe / solid
     */
    if (form.status === SEMANTIC_FORM_STATUS.NEW || form.sources.length === 1)
      await this.enrichSemanticForm(form);

    const bundle = form.bundle;

    /**
     * NOTE: we expect that at this point sources (spec., meta, ...) have been set on the semantic-form
     */
    bundle.source = {
      content: await new SourceDataExtractor().extract(
          form.uri,
          bundle.specification.definition),
    };
    return {form, bundle};
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
    blockMutationsReadOnly(form,
        'Could not delete the semantic-form as it has already been submitted.');
    await this.mutator.delete(bundle.source.content, form.graph);
    await this.mutator.delete(form.toNT(), form.graph);
  }

  /**
   * Updates {@link SemanticForm} with provided UUID.
   *
   * [CONSIDERED AUTH. SAFE]
   *
   * TODO:  if the given delta is NOT a semantic-form, we should try and enrich it if need be (TYPE, UUID)
   *
   * @param uuid
   * @param delta = {additions, removals} | {@link SemanticForm}
   *
   * @returns {Promise<void>}
   */
  async updateSemanticForm(uuid, delta) {
    const old = await this.getSemanticForm(uuid);
    blockMutationsReadOnly(old,
        'Could not update the semantic-form as it has already been submitted.');
    if (delta instanceof SemanticForm) {
      delta = {
        removals: old.toNT(),
        additions: delta.toNT(),
      };
    }
    await this.mutator.update(delta, old.graph);
  }

  /**
   * Submit the {@link SemanticForm} for the given UUID.
   *
   * [CONSIDERED AUTH. SAFE]
   *
   * Submitting a {@link SemanticForm} means:
   *  1) validating the form
   *  2) mapping to the clean model
   *  3) updating status to {@link SEMANTIC_FORM_STATUS.SENT}
   *
   * @param uuid
   *
   * @returns {Promise<void>}
   */
  async submitSemanticForm(uuid) {
    const {form, bundle} = await this.getSemanticFormBundle(uuid);
    blockMutationsReadOnly(form,
        'Could not submit the semantic-form as it has already been submitted.');

    if (isValid(form, bundle)) {
      // NOTE: model-mapping
      /**
       * TODO: temporarily disabled mapping as I'm not sure this will be how it continues
       */
      // let {prefixes, resource_definitions, mapping} = this.configuration.mapper.content;
      // const model = new Model(resource_definitions, prefixes);
      // await new ModelMapper(model).map(form.uri, mapping);
      // await this.mutator.insert(model.toNT(), form.graph);

      // NOTE: if only when "post-processing" was successfully, we update the state to "submitted"
      form.status = SEMANTIC_FORM_STATUS.SENT;
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
      status: 409,
      resource: {
        uuid: form.uuid,
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
  const form_statements = store.any(undefined, RDF('type'), FORM('Form'),
      RDFNode('http://form-graph'));
  return validateForm(form_statements, options);
}

// TODO: redo with proper escape for URI
async function getSemanticFormsInStore(uuid, {sudo = false} = {}) {
  let response;
  try {
    const stringQuery = `
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
      }`;

    if (sudo) {
      response = await query(stringQuery, true);
    } else {
      response = await authenticatedQuery(stringQuery);
    }
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

// TODO: redo with proper escape for URI
async function getSourcesInStore(formPOJO) {
  let response;
  try {
    response = await query(`
PREFIX dct: <http://purl.org/dc/terms/>
SELECT ?source
WHERE {
    GRAPH ?graph {
        <${formPOJO.uri}> dct:source ?source .
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