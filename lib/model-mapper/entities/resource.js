import { sparqlEscape } from 'mu';

export class Resource {

  constructor(key, uri, model) {
    /**
     * Internal key to identify the resource
     */
    this.key = key;
    this.uri = uri;
    this.model = model;
    this.properties = [];
  }

  get model() {
    return this._model;
  }

  set model(model) {
    this._model = model;
    this._model.resources[this.key] = this;
  }

  /**
   * NOTE: Because the UUID and URI are usually linked, when setting the URI, the UUID is reset.
   */
  set uri(uri) {
    this._uri = uri;
    this.uuid = undefined;
  }

  get uri() {
    return this._uri;
  }

  toNT() {
    let buffer = [];
    if (this.type) buffer.push(`<${this.uri}> a <${this.type}> .`);
    if (this.uuid) buffer.push(
        `<${this.uri}> <http://mu.semte.ch/vocabularies/core/uuid> ${sparqlEscape(this.uuid, 'string')} .`);
    buffer = buffer.concat(this.properties.map(prop => prop.toNT()));
    return buffer.join('\n').trim();
  }

}