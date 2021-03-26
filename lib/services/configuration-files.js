import { VERSIONED_CONFIGURATION_WATCHER, VERSIONED_CONFIGURATION_ROOT, DEBUG_LOGS } from '../../env';
import moment from 'moment';
import { SemanticFile } from '../entities/semantic-file';
import { DirectorySynchronizer } from './directory-synchronizer';
import { Gaze } from 'gaze';
import { sleep } from '../util/generic';
import { SemanticFormSpecification, SPEC_FILE_MATCHER } from '../entities/semantic-form-specification';
import { SemanticFormSources } from './semantic-form-sources';

const MAPPER_FILE_MATCHER = 'mapper.js';
const TAILORED_FILE_MATCHER = 'tailored/meta/index.js';

/**
 * Service providing the up-to-date and synced-up configuration-files.
 *
 * TODO simplify, logic moved.
 */
export class ConfigurationFiles {

  constructor() {
    this.directory = new DirectorySynchronizer(VERSIONED_CONFIGURATION_ROOT);
    this.sources = new SemanticFormSources();
    this.watcher = VERSIONED_CONFIGURATION_WATCHER;
    this.gazing = false;
  }

  /**
   * Initialization of the service.
   */
  async init() {
    await this.sync();
    return this;
  }

  /**
   * Returns the latest specification.
   *
   * @returns {SemanticFormSpecification}
   */
  get specification() {
    return new SemanticFormSpecification(this.directory.getLatestFiles());
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
   * Returns the tailored configuration files.
   *
   * @returns {undefined|SemanticFile}
   */
  get tailored(){
    const tailored = {};
    const meta = new SemanticFile({filename: `/config/${TAILORED_FILE_MATCHER}`});
    if (SemanticFile.exists(meta)) {
      tailored['meta'] = meta;
    }
    return tailored;
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
    this.gaze = new Gaze(`${VERSIONED_CONFIGURATION_ROOT}**`);
    if (enabled) {
      console.log('Gazing over the configuration-files *.*');
      this.gaze.on('all', async () => {
        if(!this.gazing) {
          console.log(
              `Configuration-files sync. triggered by watcher at ${moment()}, waiting 1 sec. before starting ...`);
          this.gazing = true;
          await sleep(1000);
          try {
            await this.sync();
          } catch (e) {
            console.error(`Configuration-files sync. watcher FAILED at ${moment()}`);
            console.error(e);
          } finally {
            this.gazing = false;
          }
        }
      });
    } else {
      this.gaze.close();
    }
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

    let {processed, missing} = await this.directory.sync();

    if (!processed.length) {
      const buffer = [];
      buffer.push('[ERROR] No versioned files found!\n');
      if (!missing.length) {
        buffer.push('Is this your first time using the service? ');
        buffer.push('If so, make sure to drop versioned configuration files (like for ex: form.ttl) ');
        buffer.push('in the configured VERSIONED_FILES_ROOT.');
      } else {
        buffer.push('All synchronized configuration files have been lost. ');
        buffer.push('Did something accidentally remove files in the root version route?');
      }
      throw buffer.join('');
    }

    // NOTE: triggers validation
    this.specification;
    this.mapper;

    const end = moment();
    const diff = moment.duration(start.diff(end));
    console.log(`Synchronization of configuration-files succeeded at ${end}. That took me only ${diff.humanize()}!`);
  }
}