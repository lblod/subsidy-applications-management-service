import { APP_URI, DEBUG_LOGS, META_DATA_ROOT } from '../../env';
import moment from 'moment';
import { SemanticFile } from '../entities/semantic-file';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { MetaDataGenerationService } from './meta-data-generation-service';
import { SemanticFileSyncService } from './semantic-file-sync-service';

const PUBLISHER = `${APP_URI}/meta-data-service`;

export const META_FILE_MATCHER = '-meta.ttl';

export class MetaDataService extends SemanticFileSyncService {

  constructor(configSyncService) {
    super(PUBLISHER, META_DATA_ROOT);
    this.generator = new MetaDataGenerationService(configSyncService);
    this.debug = DEBUG_LOGS;
  }

  async init() {
    await this.sync();
    return this;
  }

  // TODO needs to go into a cron-job to ensure that the meta-data is always up-to-date
  async sync() {
    try {
      const start = moment();
      console.log(`Started sync. of meta-files @ ${moment().toISOString()} ...`);
      const {finished} = await super.sync();

      const latest_meta_content = await this.generator.generate();
      const latest_meta_content_hash = SemanticFile.generateContentHash(latest_meta_content);

      if (finished.length) {
        const previous_meta_file = this.latest;
        const previous_meta_file_hash = SemanticFile.generateContentHash(previous_meta_file);

        if (latest_meta_content_hash === previous_meta_file_hash) {
          const end = moment();
          console.log(`Sync. of meta files succeeded @${end}. That took me only ${moment.duration(start.diff(end)).
              humanize()}!`);
          return previous_meta_file;
        }
      }
      const latest_meta_filename = `${META_DATA_ROOT}${uuidv4()}${META_FILE_MATCHER}}`;
      if (this.debug) {
        console.log(`[NEW]  ${latest_meta_content}`);
      }
      fs.writeFileSync(latest_meta_filename, latest_meta_content);
      return await this.sync();
    } catch (e) {
      if (this.debug) {
        console.log(e);
      }
      throw `Something unexpected happened when trying to sync. the meta-files.\nReason: ${e.message}`;
    }
  }

  get latest() {
    return this.getLatestFor(META_FILE_MATCHER);
  }
}