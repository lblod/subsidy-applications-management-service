/**
 *  Class representation off a semantic-form-bundle
 */
export class SemanticFormBundle {

  constructor({specification, source, meta} = {}) {
    this.specification = specification;
    this.source = source;
    this.meta = meta;
  }

  toJSON() {
    return {
      form: this.specification.content,
      source: this.source.content,
      meta: this.meta.content,
    };
  }
}