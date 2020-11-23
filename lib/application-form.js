import { sparqlEscapeString } from 'mu';

import { getSourceData, removeSourceData, updateSourceData } from './source-data';
import { DCT, MU, parse, RDF, RDFNode, serialize } from './util/rdflib';
import { getFileContent } from './util/file';
import { ACTIVE_FORM_URI, DEFAULT_CONFIG, USER_CONFIG } from '../env';
import { getSubject } from './util/database';

const TYPE = 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';

const GRAPHS = {
  source: 'http://source-graph',
  form: 'http://form-graph',
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
    return serialize(this.graph, {graph: GRAPHS.form, contentType: 'text/turtle'});
  }

  /**
   * Initialises a application-form object based on the given uuid
   *
   * @param uuid unique identifier of the application-form
   *
   * @returns {Promise<ApplicationForm>}
   */
  async init(uuid) {

    // NOTE: barrier, if this fails we assume the user to NOT have the proper rights to access this resource.
    const subject = await getSubject(uuid, TYPE);

    const options = {
      prefixes: USER_CONFIG['application-form'].prefixes,
      where: `<${subject}> mu:uuid ${sparqlEscapeString(uuid)}; rdf:type <${TYPE}> .`,
      paths: USER_CONFIG['application-form'].paths,
      graph: GRAPHS.source,
      sudo: true,
    };

    /**
     * TODO:
     * in the future this should be replaced with a function that will construct the source-data
     * based on the `sh:path`'s defined in the linked form configuration.
     */
    this.graph = await getSourceData(options);

    this.rdflibURI = this.graph.any(undefined, RDF('type'), RDFNode(TYPE));
    this.rdflibUUID = this.graph.any(this.rdflibURI, MU('uuid'), undefined);
    this.rdflibForm = this.graph.any(this.rdflibURI, DCT('source'), undefined);
    if (this.rdflibForm) {
      parse(await getFileContent(this.formURI), this.graph, {graph: GRAPHS.form});
    } else {
      parse(await getFileContent(ACTIVE_FORM_URI), this.graph, {graph: GRAPHS.form});
    }
    return this;
  }

  async delete() {
    await removeSourceData(this.graph, {graph: GRAPHS.source});
  }

  async update(delta) {
    await updateSourceData(delta);
  }
}