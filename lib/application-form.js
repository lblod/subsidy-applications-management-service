import { sparqlEscapeString } from 'mu';

import { getSourceData, removeSourceData, updateSourceData } from './source-data';
import { DCT, MU, parse, RDF, RDFNode, serialize } from './util/rdflib';
import { getFileContent } from './util/file';
import { ACTIVE_FORM_URI, CONFIG } from '../env';

const TYPE = 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';

const GRAPHS = {
  source: 'http://lblod.data.gift/services/subsidy-applications-management-service/source-graph',
  form: 'http://lblod.data.gift/services/subsidy-applications-management-service/form-graph',
};

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
    return serialize(this.graph, {graph: GRAPHS.source});
  }

  get form() {
    return serialize(this.graph, {graph: GRAPHS.form});
  }

  /**
   * Initialises a application-form object based on the given uuid
   *
   * @param uuid unique identifier of the application-form
   *
   * @returns {Promise<ApplicationForm>}
   */
  async init(uuid) {

    // TODO make this more solid
    // - prefixes could not be supplied ect ..
    const options = {
      prefixes: CONFIG['application-form'].prefixes,
      where: `?s mu:uuid ${sparqlEscapeString(uuid)}; rdf:type <${TYPE}> .`,
      paths: CONFIG['application-form'].paths,
    };

    /**
     * TODO:
     * in the future this should be replaced with a function that will construct the source-data
     * based on the `sh:path`'s defined in the linked form configuration.
     */
    this.graph = await getSourceData(options);

    this.rdflibURI = this.graph.any(undefined, RDF('type'), RDFNode(TYPE));
    if (this.uri) {
      this.rdflibUUID = this.graph.any(this.rdflibURI, MU('uuid'), undefined);
      this.rdflibForm = this.graph.any(this.rdflibURI, DCT('source'), undefined);
      if (this.rdflibForm) {
        parse(await getFileContent(this.formURI), this.graph, {graph: GRAPHS.form});
      } else {
        parse(await getFileContent(ACTIVE_FORM_URI), this.graph, {graph: GRAPHS.form});
      }
      return this;
    }
    throw {
      status: 404,
      message: `Could not find an application-form for uuid \"${uuid}\". Are you sure you have access to this object?`,
    };
  }

  async delete() {
    await removeSourceData(this.graph, {graph: GRAPHS.source});
  }

  async update(delta) {
    await updateSourceData(delta);
  }
}