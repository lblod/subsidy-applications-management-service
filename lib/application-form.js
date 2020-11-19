import { sparqlEscapeString } from 'mu';

import { getSourceData, GRAPHS, removeSourceData, updateSourceData } from './source-data';
import { DCT, MU, RDF, RDFNode, serialize } from './util/rdflib';
import { CONFIGURATION } from '../app';

const TYPE = 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';

export class ApplicationForm {

  constructor() {
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
    return serialize(this.graph, {graph: GRAPHS.source} );
  }

  /**
   * Initialises a application-form object based on the given uuid
   *
   * @param uuid unique identifier of the application-form
   *
   * @returns {Promise<ApplicationForm>}
   */
  async init(uuid) {

    // TODO make configurable from the outside
    const options = {
      prefixes: CONFIGURATION['application-form'].prefixes,
      where: `?s mu:uuid ${sparqlEscapeString(uuid)}; rdf:type <${TYPE}> .`,
      paths: CONFIGURATION['application-form'].paths
    };

    /**
     * TODO:
     * in the future this should be replaced with a function that will construct the source-data
     * based on the `sh:path`'s defined in the linked form configuration.
     */
    this.graph = await getSourceData(options);

    this.rdflibURI = this.graph.any(undefined, RDF('type'), RDFNode(TYPE));
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

  async delete() {
    await removeSourceData(this.graph, {graph: GRAPHS.source} );
  }

  async update(delta) {
    await updateSourceData(delta);
  }
}