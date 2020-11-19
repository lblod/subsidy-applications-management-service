import { sparqlEscapeString } from 'mu';

import { graph as Graph, sym as rdfNode } from 'rdflib';

import { DCT, loadDBintoRDFLIBStore, MU, RDF, serialize } from './util/db-to-rdflib';

const TYPE = 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';

export class ApplicationForm {

  constructor() {
    this.graph = new Graph();
  }

  get uri() {
    return this.rdflibURI && this.rdflibURI.value;
  }

  get uuid() {
    return this.rdflibUUID && this.rdflibUUID.value;
  }

  get formURI() {
    return this.rdflibForm && this.rdflibForm.value;
  }

  get source() {
    return serialize(this.graph);
  }

  async init(uuid) {
    const options = {
      prefixes: [
        'PREFIX mu: <http://mu.semte.ch/vocabularies/core/>',
        'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>',
      ],
      where: `?s mu:uuid ${sparqlEscapeString(uuid)}; rdf:type <${TYPE}> .`,
    };

    /**
     * NOTE:
     * in the future this should be replaced with a function that will construct the source-data
     * based on the `sh:path`'s defined in the linked form configuration.
     */
    await loadDBintoRDFLIBStore(this.graph, options);

    this.rdflibURI = this.graph.any(undefined, RDF('type'), rdfNode(TYPE));
    if(this.uri) {
      this.rdflibUUID = this.graph.any(this.rdflibURI, MU('uuid'), undefined);
      this.rdflibForm = this.graph.any(this.rdflibURI, DCT('source'), undefined);
      return this;
    }
    throw {
      status: 404,
      message: `Could not find an application-form for uuid \"${uuid}\". Are you sure you have access to this object?`
    }
  }

}