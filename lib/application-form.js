import { validateForm } from '@lblod/submission-form-helpers';

import { getSourceData, removeSourceData, updateSourceData } from './source-data';
import { ADMS, DCT, FORM, MU, parse, RDF, RDFNode, serialize } from './util/rdflib';
import { getFileContent } from './util/file';
import { ACTIVE_FORM_URI, USER_CONFIG } from '../env';
import { getSubject } from './util/database';

const TYPE = 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';

const STATES = {
  sent: 'http://lblod.data.gift/concepts/9bd8d86d-bb10-4456-a84e-91e9507c374c',
  concept: 'http://lblod.data.gift/concepts/79a52da4-f491-4e2f-9374-89a13cde8ecd',
};

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

  get status() {
    return this.rdflibStatus && this.rdflibStatus.value;
  }

  get submitted() {
    return this.status === STATES.sent;
  }

  get source() {
    return serialize(this.graph, {graph: GRAPHS.source});
  }

  get form() {
    return serialize(this.graph, {graph: GRAPHS.form, contentType: 'text/turtle'});
  }

  // TODO needs proper testing.
  get isValid() {
    const options = {
      formGraph: GRAPHS.form,
      sourceGraph: GRAPHS.source,
      sourceNode: this.rdflibURI,
      store: this.graph,
    };
    const form = this.graph.any(undefined, RDF('type'), FORM('Form'), RDFNode(GRAPHS.form));
    return validateForm(form, options);
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
    const node = await getSubject(uuid, TYPE);

    const options = {
      resource: {
        prefixes: USER_CONFIG['application-form'].prefixes,
        properties: USER_CONFIG['application-form'].properties,
        node
      },
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
    this.rdflibStatus = this.graph.any(this.rdflibURI, ADMS('status'), undefined);
    if (this.rdflibForm) {
      parse(await getFileContent(this.formURI), this.graph, {graph: GRAPHS.form});
    } else {
      parse(await getFileContent(ACTIVE_FORM_URI), this.graph, {graph: GRAPHS.form});
    }
    return this;
  }

  async delete() {
    if (!this.submitted) {
      await removeSourceData(this.graph, {graph: GRAPHS.source});
    } else {
      throw {
        status: 304,
        message: `Could not delete the application-form for UUID "${this.uuid}" as it has already been submitted.`,
      };
    }
  }

  async update(delta) {
    if (!this.submitted) {
      await updateSourceData(delta);
    } else {
      throw {
        status: 304,
        message: `Could not update the application-form for UUID "${this.uuid}" as it has already been submitted.`,
      };
    }
  }

  async submit() {
    if (!this.submitted) {
      if (this.isValid) {
        // TODO is there a better way?
        const additions = `<${this.uri}> ${ADMS('status')} <${STATES.sent}> .`;
        const removals = `<${this.uri}> ${ADMS('status')} <${STATES.concept}> .`;
        await this.update({additions, removals});
      } else {
        // TODO looks a little funny :s
        throw {
          status: 422,
          message: `Could not submit the application-form for UUID "${this.uuid}" as not all conditions were met.`,
        };
      }
    } else {
      throw {
        status: 304,
        message: `Could not submit the application-form for UUID "${this.uuid}" as it has already been submitted.`,
      };
    }
  }
}