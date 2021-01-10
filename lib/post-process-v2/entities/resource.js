import { Property } from './property';
import { Reference } from './reference';

export class Resource {

  constructor({uri, uuid, type, properties, references}, model) {
    this._uri = uri;
    this._uuid = uuid; // conditional
    this._type = type; // conditional
    this._model = model;
    this._properties = [];
    properties && properties.forEach(prop => new Property(prop, this));
    references && references.forEach(ref => new Reference(ref, this));
  }

  addProperty(property) {
    this._properties.push(property);
  }

  toNT() {
    return `
    ${this._type ? `<${this._uri}> a <${this._type}> .` : ''}
    ${this._uuid ? `<${this._uri}> <http://mu.semte.ch/vocabularies/core/uuid> <${this._uuid}> .` : ''}
    ${this._properties.map(prop => prop.toNT()).join('\n')}
    `.trim();
  }
}