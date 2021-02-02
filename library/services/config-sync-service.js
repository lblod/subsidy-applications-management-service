import { FileSyncService } from './file-sync-service';
import { VersionFile } from '../entities/version-file';
import { APP_URI, VERSIONED_CONFIGURATION_ROOT } from '../../env';
import moment from 'moment';
import { FilePOJO } from '../entities/file-pojo';

const PUBLISHER = `${APP_URI}/configuration-sync-service`;

export class ConfigSyncService extends FileSyncService {

  constructor() {
    super(PUBLISHER, VERSIONED_CONFIGURATION_ROOT);
  }

  async init() {
    await this.sync();
    return this;
  }

  async sync() {
    console.log(`Started sync. of configuration files @ ${moment().toISOString()} ...`);

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

    if (missing.length) {
      const buffer = [];
      buffer.push('[WARNING] Breaking changes detected!');
      buffer.push('Configuration files that have been saved in-store are removed from disk.');
      buffer.push(`Did something accidentally remove files in the root version route"?`);
      console.log(buffer.join('\n'));
    }

    const buffer = [];
    buffer.push('[ERROR] Missing configuration files:');
    if (!this.FORM_FILE) {
      buffer.push('\t\t- coudn\'t find a form.ttl');
    }
    if (!this.CONFIG_FILE) {
      buffer.push('\t\t- coudn\'t find a config.json');
    }
    if (!this.MAPPER_FILE) {
      buffer.push('\t\t- coudn\'t find a mapper.js');
    }
    if (buffer.length > 1) {
      throw buffer.join('\n');
    }

    console.log(`Sync. of configuration files succeeded @${moment().toISOString()}.`);
  }

  get FORM_FILE() {
    return this.getLatestFor('form.ttl');
  }

  get CONFIG_FILE() {
    return this.getLatestFor('config.json');
  }

  get MAPPER_FILE() {
    const file = new FilePOJO({filename: '/config/mapper.js'});
    if (FilePOJO.exists(file)) {
      return file;
    }
    return undefined;
  }

  toJSON() {
    return {
      FORM: this.FORM_FILE,
      CONFIG: this.CONFIG_FILE,
      MAPPER: this.MAPPER_FILE,
    };
  }

  /* [PRIVATE FUNCTIONS] */

  async getFilesOnDisk() {
    const files = await super.getFilesOnDisk();
    return files.map(file => VersionFile.copy(file));
  }

}