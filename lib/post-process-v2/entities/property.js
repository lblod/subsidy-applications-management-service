import { sparqlEscape } from 'mu';
import { ObjectFactory } from '../factories/object-factory';

export class Property {

  constructor({predicate, object}, resource) {
    this.resource = resource;
    this._factory = new ObjectFactory(this._resource._model);

    this._predicate = predicate;
    this._object = this._factory.produceObject(object);
  }

  set resource(resource) {
    this._resource = resource;
    this._resource.addProperty(this);
  }

  get subject() {
    return this._resource._uri;
  }

  get predicate() {
    return this._predicate;
  }

  get object() {
    return this._object;
  }

  toNT() {
    return `<${this.subject}> <${this.predicate}> ${sparqlEscape(this.object.value, this.object.datatype)} .`.trim();
  }
}