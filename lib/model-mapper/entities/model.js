import { ResourceBuilder } from '../builders/resource-builder';

export class Model {

  /**
   * Default pre-defined prefixes
   */
  _prefixes = {
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    mu: 'http://mu.semte.ch/vocabularies/core/',
  };

  /**
   * Default pre-defined objects
   */
  _pre_defined_objects = {
    '$NOW': new class {
      datatype = 'dateTime';

      get value() {
        return new Date().toISOString();
      }
    },
  };

  constructor(resource_definitions = {}, prefixes = [], pre_defined_objects = {}) {
    this.resource_definitions = resource_definitions;
    this.pre_defined_objects = pre_defined_objects;
    this.prefixes = prefixes;
    this.resources = {};
  }

  /**
   * Returns the resource in the model for the given key
   *
   * @param key
   * @returns Resource
   */
  get(key) {
    if (!this.resources[key]) {
      const builder = new ResourceBuilder().key(key).model(this);
      if (this.resource_definitions[key]) {
        const declaration = this.resource_definitions[key];
        builder.uuid(declaration.uuid).
            uri(declaration.uri).
            base(declaration.base).
            type(declaration.type).
            properties(declaration.properties).
            references(declaration.references).
            pre_defined_objects(this.pre_defined_objects);
      }
      builder.build();
    }
    return this.resources[key];
  }

  toNT() {
    let buffer = Object.entries(this.prefixes).map(([title, uri]) => `@prefix ${title}: <${uri}>\n`);
    buffer.push('\n\n');
    buffer = buffer.concat(Object.values(this.resources).map((resource) => `${resource.toNT()}\n\n`));
    return buffer.join('').trim();
  }


  set prefixes(prefixes) {
    Object.entries(prefixes).forEach(([key, uri]) => {
      this._prefixes[key] = uri;
    });
  }

  get prefixes () {
    return this._prefixes;
  }

  set pre_defined_objects(object) {
    Object.entries(object).forEach(([key, definition]) => {
      this._pre_defined_objects[key] = definition;
    });
  }

  get pre_defined_objects () {
    return this._pre_defined_objects;
  }
}