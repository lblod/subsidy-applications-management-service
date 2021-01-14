import { Property } from '../../entities/property';

export class MapPropertyStrategy {

  constructor(configuration) {
    this.configuration = configuration;
  }

  map(object, model) {
    const resource = model.get(this.configuration.resource);
    const predicate = this.configuration.predicate;

    // NOTE: translating typed-literals retrieved from db
    // TODO improve
    if (object.datatype) {
      object.datatype = object.datatype.substring(object.datatype.indexOf('#') + 1);
    } else {
      object['datatype'] = object.type;
    }

    // NOTE: a property links itself to the given resource.
    new Property(predicate, object, resource);
  }
}