/** STRATEGIES **/
import { MapResourceStrategy } from './strategies/map-resource-strategy';
import { MapPropertyStrategy } from './strategies/map-property-strategy';

export class MappingStrategyFactory {

  static STRATEGIES = {
    'resource': (strategy) => new MapResourceStrategy(strategy),
    'property': (strategy) => new MapPropertyStrategy(strategy)
  };

  static produce(strategy){
    if(!this.STRATEGIES[strategy.type]) throw new Error(`Couldn't find a mapping strategy for type "${strategy.type}"`);
    return this.STRATEGIES[strategy.type](strategy);
  }

}