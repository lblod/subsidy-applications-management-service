import moment from 'moment';
import { SemanticFile } from '../entities/semantic-file';
import { SemanticFormFiles } from './semantic-form-files';

const MAPPER_FILE_MATCHER = 'mapper.js';

/**
 * Service providing the up-to-date and synced-up configuration-files.
 *
 * TODO simplify, logic moved.
 */
export class Configuration {

  constructor() {
    this.semeanticFormFiles = new SemanticFormFiles();
  }

  /**
   * Initialization of the service.
   */
  async init() {
    await this.sync();
    return this;
  }

  /**
   * Returns the semantic-form-files
   */
  get forms() {
    return this.semeanticFormFiles;
  }

  /**
   * Returns the mapper configuration file.
   *
   * @returns {undefined|SemanticFile}
   */
  get mapper() {
    const file = new SemanticFile({filename: `/config/${MAPPER_FILE_MATCHER}`});
    if (SemanticFile.exists(file)) {
      return file;
    }
    throw `[ERROR] Missing configuration file: ${MAPPER_FILE_MATCHER}`;
  }

  /**
   * Synchronize the configuration-files saved in-store with the once saved on-disk.
   * Added functionality => throws error if configuration-files are missing
   *
   * @returns {Promise<void>}
   */
  async sync() {
    const start = moment();
    console.log(`Started synchronizing configuration-files at ${start} ...`);

    await this.semeanticFormFiles.init();
    // let {processed, missing} = await this.directory.sync();

    // if (!processed.length) {
    //   const buffer = [];
    //   buffer.push('[ERROR] No versioned files found!\n');
    //   if (!missing.length) {
    //     buffer.push('Is this your first time using the service? ');
    //     buffer.push('If so, make sure to drop versioned configuration files (like for ex: form.ttl) ');
    //     buffer.push('in the configured VERSIONED_FILES_ROOT.');
    //   } else {
    //     buffer.push('All synchronized configuration files have been lost. ');
    //     buffer.push('Did something accidentally remove files in the root version route?');
    //   }
    //   throw buffer.join('');
    // }

    // NOTE: triggers validation
    // this.specification;
    this.mapper;

    const end = moment();
    const diff = moment.duration(start.diff(end));
    console.log(`Synchronization of configuration-files succeeded at ${end}. That took me only ${diff.humanize()}!`);
  }
}