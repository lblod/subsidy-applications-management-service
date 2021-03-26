import { DirectorySynchronizer } from './directory-synchronizer';
import { SemanticFile } from '../entities/semantic-file';
import { SemanticFormSpecification } from '../entities/semantic-form-specification';

const TAILORED_FILE_MATCHER = 'tailored/meta/index.js';

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

  constructor({name, path}) {
    this.name = name;
    this.path = path;
    this.versionedFiles = new DirectorySynchronizer(`${path}versions/`);
  }

  async init() {
    await this.versionedFiles.sync();
    return this;
  }

  /**
   * Returns the latest specification.
   *
   * @returns {SemanticFormSpecification}
   */
  get specification() {
    return new SemanticFormSpecification(this.versionedFiles.getLatestFiles());
  }

  /**
   * Returns the tailored configuration files.
   *
   * @returns {undefined|SemanticFile}
   */
  get tailored() {
    const tailored = {};
    const meta = new SemanticFile({filename: `${this.path}${TAILORED_FILE_MATCHER}`});
    if (SemanticFile.exists(meta)) {
      tailored['meta'] = meta;
    }
    return tailored;
  }

}