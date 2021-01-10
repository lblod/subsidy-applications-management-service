
/** STRATEGIES **/
import { MapResourceStrategy } from './strategies/map-resource-strategy';
import { MapPropertyStrategy } from './strategies/map-property-strategy';

export class MappingStrategyFactory {

  STRATEGIES = {
    'resource': (mapping, object) => new MapResourceStrategy(mapping, object, this.model),
    'property': (mapping, object) => new MapPropertyStrategy(mapping, object, this.model)
  };

  constructor(model) {
    this.model = model;
  }

  produce(mapping, object){
    if(!this.STRATEGIES[mapping.type]) throw new Error(`Couldn't find a mapping strategy for type "${mapping.type}"`);
    return this.STRATEGIES[mapping.type](mapping, object);
  }

}