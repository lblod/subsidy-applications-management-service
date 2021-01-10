import { v4 as uuidv4 } from 'uuid';
import { Resource } from '../entities/resource';
import { Property } from '../entities/property';
import { Reference } from '../entities/reference';

export class ResourceEntityFactory {

  constructor(model) {
    this.model = model;
  }

  produce(key) {

    // NOTE: Retrieve the declaration from the configuration
    const declaration = this.model.config.resource_declarations[key];

    // NOTE: if no URI was passed we assume this to be a new Resource and generate a new URI.
    if (!declaration.uri) {
      declaration['uuid'] = uuidv4();
      declaration['uri'] = `${declaration.base}/${declaration.uuid}`;
    }

    const resource = new Resource(declaration, this.model);

    // NOTE: add create properties and references baded on the configuration
    declaration.properties && declaration.properties.forEach(prop => new Property(prop, resource));
    declaration.references && declaration.references.forEach(ref => new Reference(ref, resource));

    return resource;
  }
}