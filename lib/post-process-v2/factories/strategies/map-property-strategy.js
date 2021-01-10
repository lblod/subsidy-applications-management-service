import { Property } from '../../entities/property';
import { MapStrategy } from './map-strategy';

export class MapPropertyStrategy extends MapStrategy{

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
    const resource = this.model.getResource(this.mapping.resource);
    const property = {
      predicate: this.mapping['s-prefix'],
      object: {
        value: this.object.value,
        datatype: this.object.type,
      },
    };
    // NOTE: a property links itself to the given resource.
    new Property(property, resource);
  }
}