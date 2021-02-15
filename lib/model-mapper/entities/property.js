import { sparqlEscape } from 'mu';

export class Property {

  constructor(predicate, object, resource) {
    this.resource = resource;
    this.predicate = predicate;
    this.object = object;
  }

  set resource(resource) {
    this._resource = resource;
    this._resource.properties.push(this);
  }

  get resource() {
    return this._resource;
  }

  get subject() {
    return this._resource._uri;
  }

  set object(object) {
    this._object = object; // this.objectEntityFactory.produce(object);
  }

  get object() {
    return this._object;
  }

  toNT() {
    return `<${this.subject}> ${this.predicate} ${sparqlEscape(this.object.value, this.object.datatype)} .`.trim(); // TODO redo with proper escape
  }
}