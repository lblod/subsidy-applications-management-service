import { validateForm } from '@lblod/submission-form-helpers';

import { getSourceData, removeSourceData, updateSourceData } from './source-data';
import { ADMS, DCT, FORM, MU, parse, RDF, RDFNode, serialize } from './util/rdflib';
import { DEFAULT_CONFIG, USER_CONFIG } from '../env';
import { getSubject } from './util/database';
import { getFileContent, uriToPath } from './util/file';
import { getActiveFormFile, syncFormFiles } from './form-data';

// TODO make configurable
const TYPE = 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';

const STATES = {
  sent: 'http://lblod.data.gift/concepts/9bd8d86d-bb10-4456-a84e-91e9507c374c',
  concept: 'http://lblod.data.gift/concepts/79a52da4-f491-4e2f-9374-89a13cde8ecd',
};

const GRAPHS = {
  source: 'http://source-graph',
  form: 'http://form-graph',
  meta: 'http://meta-graph',
};

export class Form {

  constructor(versionService) {
    this.versionService = versionService;
  }

  get uri() {
    return this.rdflibURI && this.rdflibURI.value;
  }

  get uuid() {
    return this.rdflibUUID && this.rdflibUUID.value;
  }

  get versionURI() {
    if(!this.rdflibVersion) {
      const active = this.versionService.active;
      // TODO need to find a better way off updating and keeping the local store in sync (maybe using the ForkingStore?)
      const additions = `<${this.uri}> ${DCT('source')} <${active.uri}> .`;
      this.update({additions}); // NOTE: no need to wait ...
      this.graph.add(this.rdflibURI, DCT('source'), RDFNode(active.uri), RDFNode(GRAPHS.source));
      this.rdflibVersion = this.graph.any(this.rdflibURI, DCT('source'), undefined);
    }
    return this.rdflibVersion.value;
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

  get meta() {
    return serialize(this.graph, {graph: GRAPHS.meta, contentType: 'text/turtle'});
  }

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
   * @returns {Promise<Form>}
   */
  async init(uuid) {

    // NOTE: barrier, if this fails we assume the user to NOT have the proper rights to access this resource.
    const node = await getSubject(uuid, TYPE);

    // NOTE: first process default required fields to create a form
    let options = {};
    options['resource'] = DEFAULT_CONFIG['application-form'];
    options['resource'].node = node;
    options['graph'] = GRAPHS.source;
    options['sudo'] = true;
    this.graph = await getSourceData(options);

    this.rdflibURI = this.graph.any(undefined, RDF('type'), RDFNode(TYPE));
    this.rdflibUUID = this.graph.any(this.rdflibURI, MU('uuid'), undefined);
    this.rdflibVersion = this.graph.any(this.rdflibURI, DCT('source'), undefined);
    this.rdflibStatus = this.graph.any(this.rdflibURI, ADMS('status'), undefined);

    // NOTE we assume that from these point on the active version has been set
    // TODO names configurable ...
    parse(await getFileContent(`${this.versionURI}/form.ttl`), this.graph, {graph: GRAPHS.form});
    parse(await getFileContent(`${this.versionURI}/meta.ttl`), this.graph, {graph: GRAPHS.meta});

    /**
     * NOTE: process user defined source
     *
     * TODO:
     * in the future this should be replaced with a function that will construct the source-data
     * based on the `sh:path`'s defined in the linked form configuration.
     */
    options['resource'] = require(uriToPath(`${this.versionURI}/config.json`))['application-form'];
    options['resource'].node = node;

    this.graph = await getSourceData(options, this.graph);

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
        // TODO need to find a better way off updating and keeping the local store in sync (maybe using the ForkingStore?)
        const additions = `<${this.uri}> ${ADMS('status')} <${STATES.sent}> .`;
        const removals = `<${this.uri}> ${ADMS('status')} <${STATES.concept}> .`;
        await this.update({additions, removals});
      } else {
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