import { MapStrategy } from './map-strategy';

export class MapResourceStrategy extends MapStrategy{

  constructor(mapping, object, model) {
    super(mapping, object, model);
  }

  resolve() {
    super.resolve();
    if(!this.object){
      // NOTE: if the value was not found when not required, we just ignore resolving it
      return {
        status: 'ignored'
      };
    }
    const resource = this.model.getResource(this.mapping.as);
    resource.uri = this.object.value;
  }
}