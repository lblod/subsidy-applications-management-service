import { ResourceBuilder } from '../builders/resource-builder';

export class Model {

  constructor(definitions = {}, prefixes = []) {
    this.definitions = definitions;
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
    // TODO not happy about this yet
    if (!this.resources[key]) {
      const builder = new ResourceBuilder().key(key).model(this);
      if (this.definitions[key]) {
        const declaration = this.definitions[key];
        builder.uuid(declaration.uuid).
            uri(declaration.uri).
            base(declaration.base).
            type(declaration.type).
            properties(declaration.properties).
            references(declaration.references);
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
}