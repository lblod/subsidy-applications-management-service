import { sparqlEscape } from 'mu';
import { ObjectEntityFactory } from '../factories/object-entity-factory';

export class Property {

  constructor({predicate, object}, resource) {
    this.resource = resource;
    this.objectEntityFactory = new ObjectEntityFactory(this); // TODO improve (not sure about the naming)

    this.predicate = predicate;
    this.object = object;
  }

  /**
   * Boiler plate function in witch possible async post-processing can be placed
   * @returns {Promise<void>}
   */
  async resolve() {
  }

  set resource(resource) {
    this._resource = resource;
    this._resource.addProperty(this);
  }

  get resource() {
    return this._resource;
  }

  get subject() {
    return this._resource._uri;
  }

  set object(object) {
    this._object = this.objectEntityFactory.produce(object);
  }

  get object() {
    return this._object;
  }

  toNT() {
    return `<${this.subject}> ${this.predicate} ${sparqlEscape(this.object.value, this.object.datatype)} .`.trim();
  }
}