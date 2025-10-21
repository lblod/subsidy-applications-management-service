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
      let form;
      
      if (forms.length > 1) {
        console.log(`Form was found in ${forms.length} graphs:`, forms.map(f => f.graph));
        
        // If the form was found in 2 graphs, prioritize the one with the organizations graph
        // This to prevent writing to the subsidiedatabank graph
        const organizationForm = forms.find(form => 
          form.graph?.startsWith("http://mu.semte.ch/graphs/organizations/")
        );

        if (organizationForm === undefined) {
          console.warn(
            `No form was found in the organizations graph. Data could be corrupted?`);
        }
        
        form = organizationForm || forms[0];
      } else {
        form = forms[0];
      }

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
          FILTER(
            ?graph NOT IN (
              <http://mu.semte.ch/graphs/organizations/4f0eb4436c88cf831c35f84e7c34ce32f9ee4e99c5139aff62990e5e531aa1e7/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/72bc672ceb6894d8dd31dc2dff2faad2fd93f4b9f5347d556d092516eaa30aa3/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/6af55cecaea3621f53bb32417a36ed6e3d41b2aa5b9f6d62ab3d80cc8ec11539/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/d3c76fd84794dad5e12c9eed6d6332dc5e5c99daf0e4ddd7ceebf13d5d6c0ccd/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/c362abc58ac4579ff417824ce620962ac57bc344b34fe8f51d21b35ef54da36d/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/bbc23313f4c8585a0c51f15f920d77123356535cd1cad9af38f5707892c7088d/SubsidiepuntGebruiker>,              
              <http://mu.semte.ch/graphs/organizations/a3bd0845853278f478f90b14436d3efa99e73249a84d462f0ddc2e5b6e37a156/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/785e8d5516378c7382ad0e7e356d2301496d810c6cd46d72ccebb455d3ac525e/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/05441122597e0b20b61a8968ea1247c07f9014aad1f1f0709d0b1234e3dfbc2f/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/3834647b5e95ea20f5ffe5a12a09fbd3d7fdf0d187fab385cb7b841422176ad6/SubsidiepuntGebruiker>,              
              <http://mu.semte.ch/graphs/organizations/0327a51548f73607f8a5ec11b36711a3c96703686ad93a3d632718c135c295db/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/0a2d980559eb9f3e0820386541274a72692f495204cd6d951ea1907ecc65829b/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/e39bc997aa6dd9f240277735efd745b6a0422614d2b36cf01825c86b1b91a9ee/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/144c75e403c5084af57f5c0c86252b8759b56baf9694326abbcb5ea40ab69f1a/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/00eb231f51bd6b4f5dcc6536b2d09a174ea8583f5bf28b10bc4fc769a07e511d/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/ba8a253d98ea7d2ab1afc43e5e2cd145a12ccd86b68e71d023e3c13a83d7498f/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/c69192b973a3ca11531b9657b3ee20aa6688fa33ea1ef1392310fec751980ab2/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/76c45d60f05bf8afc8c71859342b69cac6a57ee2b320b900a60afd6ba9b8eb9d/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/3eb8c9fae32d02359dcd7b22e2a74e67a5b48388df31ad819c27c688fedd10b0/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/5d21ccef2f5aa3ccbf3a74c6f25ebe9f0b1ef5a97b87f3d79c86ae9d6d857df8/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/af8969752f6b28c66b6bc402d7987fa38774901ac72b95c5cb7976570487c3c9/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/fb1be873c4b31e391613dfae8e68edd694b1fdf126eeecb502b1e5cad6f2f682/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/f6b131de5e40a0dfd4fc93fedf3b95c9bf156ece718b87fe00469dea2564b3fb/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/3e077115eeb70b649d44e2ebbb218f2cfcac5d84e130c88584f0ec23f7cebbf9/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/1313d4a58f9ecf52cc7e274e3549a759b35e731973cc9f5e07562e5650f594dd/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/7c6b38fa6fc65879cb674a654617de171adfcfacba086fb918da3749dbaa43b5/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/c5dbb08e35e2d090a05d119fef4cc161b5ee1f322698cb8ea3c8c6643a521cf2/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/f2a9a2392d5e4c0f992a84a0871d048a7b91b14681e9980a63aa6ba4b1f7eb8c/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/c0b6b5cf198cd939251dff8ed052177cfff245074c6b8d43394c8c97f7b6e945/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/04895013fe6301f32aa46deae98abfb833a717ece5a33b6c453674c6d0f4cc5e/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/8ef1e4a43efd913e6b09b0ddea344b7b5d723a344ad559389a55ae1ff0bebc8f/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/f56f068943a99059f5bfc3b905fe8848a25a47cfa30fb3ed3d294b47815b2255/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/5a4b2b4f1de1f3b91b0348a7eb6d6aa0ef9420b8ec31374970c9ffe933a79515/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/3f57a17fbcdfc13def910c54948bec11d71d3f75946b0336fffc0587bf18d783/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/2564e21e3650f91625189ccb7eb055e47754a0633c54c7582a899171fef60c52/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/60daf27c2cf12dd123447aa300dd7320890391dbd8dd6b4dd7ec02258f8281b3/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/e41ffa04f94bb450a79793020e70d55b5fee5033a5280277998608a9d0913117/SubsidiepuntGebruiker>, 
              <http://mu.semte.ch/graphs/organizations/7125fcbfb7a08f8c01efbed115cea602db249c04afe9b5a2cc298cc7949cd040/SubsidiepuntGebruiker>  
            )
          )
      }`;

    if (sudo) {
      response = await query(stringQuery, true);
    } else {
      response = await authenticatedQuery(stringQuery);
    }
  } catch (e) {
    console.error("error happened here", e);
    if (DEBUG_LOGS) {
      console.error(e);
    }
    throw {
      status: 500,
      resource: {
        uuid: uuid,
      },
      message: `Something unexpected went wrong while trying to retrieve the semantic-form. here`,
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