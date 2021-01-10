import { v4 as uuidv4 } from 'uuid';
import { Resource } from '../entities/resource';

export class ResourceFactory {

  constructor(model) {
    this._model = model;
  }

  produceResource({uri, type, base, properties, references}) {
    /**
     * NOTE: if no URI was passed we assume this to be a new Resource and generate a new URI.
     */
    if(!uri) {
      const uuid = uuidv4();
      return new Resource({uuid, uri: `${base}/${uuid}`, type, properties, references}, this._model)
    }
    return new Resource({uri, type, properties, references}, this._model)
  }
}