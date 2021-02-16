import { Property } from './property';

export class Reference extends Property {

  constructor(via, as, resource) {
    super(via, {}, resource);
    // NOTE: triggers the construction of this resource if it does not exist yet
    this.as = this.resource.model.get(as);
  }

  set object(object) {
  }

  get object() {
    return {
      value: this.as.uri,
      datatype: 'uri',
    };
  }
}