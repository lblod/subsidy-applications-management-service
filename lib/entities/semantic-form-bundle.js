import { SemanticFormSpecification } from './semantic-form-specification';
import { SemanticFormMeta } from './semantic-form-meta';

/**
 *  Class representation of a semantic-form-bundle
 */
export class SemanticFormBundle {

  constructor(sources) {
    this.specification = undefined;
    this.meta = undefined;
    this.source = undefined;
    if (sources.length) {
      this.specification = new SemanticFormSpecification(sources);
      this.meta = new SemanticFormMeta(sources);
    }
  }

  toJSON() {
    return {
      form: this.specification.content,
      source: this.source.content,
      meta: this.meta.content,
    };
  }
}