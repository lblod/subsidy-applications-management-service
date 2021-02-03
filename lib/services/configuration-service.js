import { VersionFile } from '../entities/version-file';
import { APP_URI, FILE_SYNC_WATCHER, VERSIONED_CONFIGURATION_ROOT } from '../../env';
import moment from 'moment';
import { SemanticFile } from '../entities/semantic-file';
import { SemanticFileSyncService } from './semantic-file-sync-service';

const PUBLISHER = `${APP_URI}/configuration-service`;

export const SPEC_FILE_MATCHER = 'form.ttl';
export const CONFIG_FILE_MATCHER = 'config.json';

export class ConfigurationService extends SemanticFileSyncService {

  constructor() {
    super(PUBLISHER, VERSIONED_CONFIGURATION_ROOT);
    this.debug = true;
    this.watcher = FILE_SYNC_WATCHER;
  }

  async init() {
    await this.sync();
    return this;
  }

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
      buffer.push('\t\t- coudn\'t find a form.ttl');
    }
    if (!this.config) {
      buffer.push('\t\t- coudn\'t find a config.json');
    }
    if (!this.mapper) {
      buffer.push('\t\t- coudn\'t find a mapper.js');
    }
    if (buffer.length > 1) {
      throw buffer.join('\n');
    }

    const end = moment();
    console.log(`Sync. of configuration files succeeded @${end}. That took me only ${moment.duration(start.diff(end)).
        humanize()}!`);
  }

  get specification() {
    return this.getLatestFor(SPEC_FILE_MATCHER);
  }

  get config() {
    return this.getLatestFor(CONFIG_FILE_MATCHER);
  }

  get mapper() {
    const file = new SemanticFile({filename: '/config/mapper.js'});
    if (SemanticFile.exists(file)) {
      return file;
    }
    return undefined;
  }

  toJSON() {
    return {
      specification: this.specification,
      config: this.config,
      mapper: this.mapper,
    };
  }

  /* [PRIVATE FUNCTIONS] */

  async getFilesOnDisk() {
    const files = await super.getFilesOnDisk();
    return files.map(file => VersionFile.copy(file));
  }

}