import { v4 as uuidv4 } from 'uuid';
import { Resource } from '../entities/resource';
import { Property } from '../entities/property';
import { Reference } from '../entities/reference';

export class ResourceBuilder {

  build(){
    // NOTE: if no URI was passed we assume this to be a new Resource
    if (!this._uri) {
      this._uuid = uuidv4();
      this._uri = `${this._base}${this._uuid}`;
    }

    // NOTE: adds the resource to the model
    const resource = new Resource(this._key, this._uri, this._model);
    resource.uuid = this._uuid;
    resource.type = this._type;

    // NOTE: create properties, adds them to the resource
    if (this._properties) {
      this._properties.forEach(({predicate, object}) => {
        // NOTE: users can access a pre defined set of dynamic objects, here these cat translated.
        if (object && this._pre_defined_objects[object]) {
          object = this._pre_defined_objects[object];
        }
        return new Property(predicate, object, resource)
      });
    }

    // NOTE: create references, adds them to the resource
    if (this._references) {
      this._references.forEach(({via, as}) => new Reference(via, as, resource));
    }

    return resource;
  }

  /* SETTERS */

  key(value) {
    this._key = value;
    return this;
  }

  uri(value) {
    this._uri = value;
    return this;
  }

  model(value) {
    this._model = value;
    return this;
  }

  uuid(value){
    this._uuid = value;
    return this;
  }

  base(value){
    this._base = value;
    return this;
  }

  type(value){
    this._type = value;
    return this;
  }

  properties(value){
    this._properties = value;
    return this;
  }

  references(value){
    this._references = value;
    return this;
  }

  pre_defined_objects(value){
    this._pre_defined_objects = value;
    return this;
  }
}