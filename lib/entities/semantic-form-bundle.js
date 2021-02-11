import { SemanticFormSpecification } from './semantic-form-specification';
import { META_FILE_MATCHER } from '../services/meta-files';

/**
 *  Class representation off a semantic-form-bundle
 */
export class SemanticFormBundle {

  constructor(sources) {
    this.specification = undefined;
    this.meta = undefined;
    this.source = undefined;
    if (sources.length) {
      this.specification = new SemanticFormSpecification(sources);
      this.meta = sources.find(file => file.filename.includes(META_FILE_MATCHER));
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