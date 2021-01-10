
/** STRATEGIES **/
import propertyResolver from './resolvers/property-resolver';
import resourceResolver from './resolvers/resource-resolver';

export class ResolverFactory {

  RESOLVERS = {
    'resource': (resolution, object) => resourceResolver(resolution, object, this._model),
    'property': (resolution, object) => propertyResolver(resolution, object, this._model)
  };

  constructor(model) {
    this._model = model;
  }

  produceResolver(resolution, object){
    return () => this.RESOLVERS[resolution.type](resolution, object)
  }

}