export class MapStrategy {

  constructor(mapping, object, model) {
    this.mapping = mapping;
    this.object = object;
    this.model = model;
  }

  resolve() {
    if (this.mapping.required && !this.object) {
      throw new Error(`Couldn't processes mapping as a required object was not found`);
    }
  }
}