import { Property } from './property';

export class Reference extends Property {

  constructor({via, as}, resource) {
    super({predicate: via}, resource);
    this.as = as;
    this.object = {
      value: this._resource.model.getResource(this.as)._uri,
      datatype: 'uri',
    };
  }

}