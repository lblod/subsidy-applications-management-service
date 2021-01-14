/** STRATEGIES **/
import { MapResourceStrategy } from './strategies/map-resource-strategy';
import { MapPropertyStrategy } from './strategies/map-property-strategy';

export class MappingStrategyFactory {

  static STRATEGIES = {
    'resource': (directions) => new MapResourceStrategy(directions),
    'property': (directions) => new MapPropertyStrategy(directions)
  };

  static produce(directions){
    if(!this.STRATEGIES[directions.type]) throw new Error(`Couldn't find a mapping strategy for type "${directions.type}"`);
    return this.STRATEGIES[directions.type](directions);
  }

}