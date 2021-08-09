import { DirectorySynchronizer } from '../services/directory-synchronizer';
import { SemanticFile } from './semantic-file';
import { SemanticFormSpecification } from './semantic-form-specification';
import { getDirectoriesSync } from '../util/file';

const TAILORED_ROOT = 'tailored';
const TAILORED_META_INDEX = `${TAILORED_ROOT}/meta/index.js`;
const TAILORED_SOURCE_INDEX = `${TAILORED_ROOT}/source/index.js`;

export class SemanticFormConfiguration {

  /**
   *  Returns if the given directory contains valid semantic-form-configuration.
   *
   *  TODO: For now it just simply checks if it contains a "versions" folder
   *
   * @param dir
   * @returns {*}
   */
  static isConfigDir(dir) {
    return SemanticFile.exists(`${dir}/versions/`);
  }

  static getVersionedDir(path) {
    return `${path}versions/`;
  }

  constructor({name, root, sources}) {
    this.name = name;
    this.root = root;
    this.sources = sources;

    // NOTE: triggers validation
    this.specification;
  }

  /**
   * Returns the latest specification.
   *
   * @returns {SemanticFormSpecification}
   */
  get specification() {
    return new SemanticFormSpecification(this.sources);
  }

  /**
   * Returns the tailored configuration files.
   *
   * @returns {undefined|SemanticFile}
   */
  get tailored() {
    const tailored = {};
    const meta = new SemanticFile({filename: `${this.root}${TAILORED_META_INDEX}`});
    const source = new SemanticFile({filename: `${this.root}${TAILORED_SOURCE_INDEX}`});
    if (SemanticFile.exists(meta)) {
      tailored['meta'] = meta;
    }
    if (SemanticFile.exists(source)) {
      tailored['source'] = source;
    }
    return tailored;
  }

  toJSON() {
    return {
      specification: this.specification,
      tailored: this.tailored
    };
  }
}