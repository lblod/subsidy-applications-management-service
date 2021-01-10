import { sparqlEscape } from 'mu';

export class Resource {

  constructor({uri, uuid, type}, model) {
    // TODO some checks on uri validity
    this.uri = uri;
    this.uuid = uuid; // conditional
    this.type = type; // conditional
    this.model = model;
    this.properties = [];
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

  addProperty(property) {
    this.properties.push(property);
  }

  toNT() {
    return `
${this.type ? `<${this.uri}> a <${this.type}> .` : ''}
${this.uuid ? `<${this.uri}> <http://mu.semte.ch/vocabularies/core/uuid> ${sparqlEscape(this.uuid, 'string')} .` : ''}
${this.properties.map(prop => prop.toNT()).join('\n')}
    `.trim();
  }
}