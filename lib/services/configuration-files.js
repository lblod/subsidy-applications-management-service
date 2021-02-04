import { VersionFile } from '../entities/version-file';
import { SERVICE_URI, VERSIONED_CONFIGURATION_WATCHER, VERSIONED_CONFIGURATION_ROOT } from '../../env';
import moment from 'moment';
import { SemanticFile } from '../entities/semantic-file';
import { SemanticFileSync } from './semantic-file-sync';
import { Gaze } from 'gaze';
import { sleep } from '../util/generic';

const PUBLISHER = `${SERVICE_URI}/configuration-files`;

export const SPEC_FILE_MATCHER = 'form.ttl';
export const CONFIG_FILE_MATCHER = 'config.json';

/**
 * Service providing the up-to-date and synced-up configuration-files.
 */
export class ConfigurationFiles extends SemanticFileSync {

  constructor() {
    super(PUBLISHER, VERSIONED_CONFIGURATION_ROOT);
    this.debug = true;
    this.watcher = VERSIONED_CONFIGURATION_WATCHER;
  }

  /**
   * Initialization off the service.
   */
  async init() {
    await this.sync();
    return this;
  }

  /**
   * Returns the latest specification.
   *
   * @returns {undefined|SemanticFile}
   */
  get specification() {
    return this.getLatestFor(SPEC_FILE_MATCHER);
  }

  /**
   * Returns the latest config.
   *
   * @returns {undefined|SemanticFile}
   */
  get config() {
    return this.getLatestFor(CONFIG_FILE_MATCHER);
  }

  /**
   * Returns the mapper configuration file.
   *
   * @returns {undefined|SemanticFile}
   */
  get mapper() {
    const file = new SemanticFile({filename: '/config/mapper.js'});
    if (SemanticFile.exists(file)) {
      return file;
    }
    return undefined;
  }


  /**
   * Synchronize the configuration-files saved in-store with the once saved on-disk.
   * Added functionality => throws error if configuration-files are missing
   *
   * @returns {Promise<void>}
   */
  async sync() {
    const start = moment();
    console.log(`Started sync. of configuration files @ ${start} ...`);

    let {finished, missing} = await super.sync();

    if (!finished.length) {
      const buffer = [];
      buffer.push('[ERROR] No versioned files found!\n');
      if (!missing.length) {
        buffer.push('Is this your first time using the service? ');
        buffer.push('If so, make sure to drop versioned configuration files (like for ex: form.ttl) ');
        buffer.push('in the configured VERSIONED_FILES_ROOT.');
      } else {
        buffer.push('All configuration files that have been saved in-store are lost on-disk. ');
        buffer.push('Did something accidentally remove files in the root version route?');
      }
      throw buffer.join('');
    }

    const buffer = [];
    buffer.push('[ERROR] Missing configuration files:');
    if (!this.specification) {
      buffer.push(`\t\t- ${SPEC_FILE_MATCHER}`);
    }
    if (!this.config) {
      buffer.push(`\t\t- ${CONFIG_FILE_MATCHER}`);
    }
    if (!this.mapper) {
      buffer.push('\t\t- mapper.js');
    }
    if (buffer.length > 1) {
      throw buffer.join('\n');
    }

    const end = moment();
    console.log(`Sync. of configuration files succeeded @ ${end}. That took me only ${moment.duration(start.diff(end)).
        humanize()}!`);
  }


  /**
   * Setup a watcher to sync-up configuration-files when new files are added to the root.
   *
   * TODO:  Triggered for EVERY file change while our service re-syncs all files @ a time.
   *        Therefore this is sub-optimal, as it triggers a full refresh for every file.
   *
   * @param enabled
   */
  set watcher(enabled) {
    this.gaze = new Gaze(`${this.root}/**`);
    if (enabled) {
      console.log('Gazing over the configuration files o.0');
      this.gaze.on('all', async () => {
        await sleep(1000);
        await this.sync();
      });
    } else {
      this.gaze.close();
    }
  }

  /* [PRIVATE FUNCTIONS] */

  /**
   * Retrieve the files on disk.
   * Override to wrap them in {@link VersionFile} to ensure proper timestamps are set.
   *
   * @returns {Promise<VersionFile[]>}
   */
  async getSemanticFilesOnDisk() {
    const files = await super.getSemanticFilesOnDisk();
    return files.map(file => VersionFile.copy(file));
  }

}