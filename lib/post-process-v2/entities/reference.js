import { Property } from './property';

export class Reference extends Property {

  constructor({via, as}, resource) {
    super({predicate: via}, resource);
    this._as = as;
    this._object = {
      value: this._resource._model.getResource(this._as)._uri,
      datatype: 'uri',
    };
  }

}