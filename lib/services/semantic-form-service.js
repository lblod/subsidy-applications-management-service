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

export class SemanticFormService {

  constructor(versionService) {
    this.versionService = versionService;
    this.mutationService = new NTriplesMutationService({sudo: true});
  }

  async getSemanticFormFor(uuid) {
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
        message: `Something unexpected went wrong while trying to retrieve the semantic-form resource.`,
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
      let form = new SemanticForm({
        graph: binding.graph.value,
        uri: binding.uri.value,
        uuid,
        status: binding.status.value,
      });
      // NOTE: if the source/form-data was not found, we set the current active form-data directory
      if (!binding.source) {
        form.source = this.versionService.active.uri;
        this.mutationService.update(form.graph, form.toNT()); // NOTE: no need to wait
      } else {
        form.source = binding.source.value;
      }
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
        message: `Could not access or retrieve the semantic-form resource.`,
      };
    }
  }

  async getSemanticFormNTriplesFor(uuid) {
    const resource = await this.getSemanticFormFor(uuid);

    // NOTE: first process default required fields to create a semantic-form
    let mapping = DEFAULT_CONFIG.resource;
    mapping['node'] = {value: resource.uri};
    let source = await this.mutationService.get(mapping);

    /**
     * NOTE: process user defined source
     *
     * TODO:
     * in the future this should be replaced with a function that will construct the source-data
     * based on the `sh:path`'s defined in the linked form configuration.
     */
    mapping = require(uriToPath(`${resource.source}/config.json`))['resource'];
    mapping['node'] = {value: resource.uri};

    source += await this.mutationService.get(mapping);

    const form = await getFileContent(`${resource.source}/form.ttl`);
    const meta = await getFileContent(`${resource.source}/meta.ttl`);

    return {
      resource,
      source,
      form,
      meta,
    };
  }

  async deleteSemanticFormFor(uuid) {
    // NOTE: we use `getSemanticFormNTriplesFor` to ensure all date is deleted
    const form_data = await this.getSemanticFormNTriplesFor(uuid);
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
        message: `Something unexpected went wrong while trying to delete the semantic-form resource.`,
      };
    }
  }

  async updateSemanticFormFor(uuid, delta) {
    const form = await this.getSemanticFormFor(uuid);
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
        message: `Something unexpected went wrong while trying to update the semantic-form resource.`,
      };
    }
  }

  async submitSemanticFormFor(uuid) {
    const form_data = await this.getSemanticFormNTriplesFor(uuid);
    blockMutationsIfSubmitted(form_data.resource, 'Could not submit the semantic-form as it has already been submitted.');

    if (isValid(form_data)) {
      // NOTE: model-mapping
      // TODO should not come from the versioning
      let {prefixes, resource_definitions, mapping} = require(uriToPath(`${form_data.resource.source}/mapper.js`));
      const model = new Model(resource_definitions, prefixes);
      await new ModelMapper(model).map(form_data.resource.uri, mapping);
      await this.mutationService.add(form_data.resource.graph, model.toNT());

      // NOTE: if only when "post-processing" was successfully, we update the state to "submitted"
      await this.mutationService.remove(form_data.resource.graph, form_data.resource.toNT());
      form_data.resource.status = SUBMISSION_STATUSES.sent;
      await this.mutationService.add(form_data.resource.graph, form_data.resource.toNT());
    } else {
      throw {
        status: 422,
        message: `Could not submit the application-form for UUID "${uuid}" as not all conditions were met.`,
      };
    }
  }

}

/* PRIVATE FUNCTIONS */

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

// TODO
function isValid({source, form}) {
  const store = new Graph();
  const options = {
    formGraph: 'http://form-graph',
    sourceGraph: 'http://source-graph',
    sourceNode: this.rdflibURI,
    store,
  };
  parse(form, store, {graph: options.formGraph});
  parse(source, store, {graph: options.sourceGraph});
  const form_statements = this.graph.any(undefined, RDF('type'), FORM('Form'), RDFNode('http://form-graph'));
  return validateForm(form_statements, options);
}