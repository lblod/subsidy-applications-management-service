import { SERVICE_URI, DEBUG_LOGS, META_DATA_ROOT, META_DATA_CRON } from '../../env';
import moment from 'moment';
import { SemanticFile } from '../entities/semantic-file';
import { v4 as uuidv4 } from 'uuid';
import { MetaDataGeneration } from './meta-data-generation';
import { SemanticFileSync } from './semantic-file-sync';
import { CronJob } from 'cron';

const PUBLISHER = `${SERVICE_URI}/meta-data-service`;

export const META_FILE_MATCHER = '-meta.ttl';

export class MetaData extends SemanticFileSync {

  constructor(configSyncService) {
    super(PUBLISHER, META_DATA_ROOT);
    this.generator = new MetaDataGeneration(configSyncService);
    this.cron = META_DATA_CRON;
    this.debug = DEBUG_LOGS;
  }

  async init() {
    await this.sync();
    return this;
  }

  async sync() {
    try {
      const start = moment();
      console.log(`Started sync. of meta-files @ ${moment().toISOString()} ...`);
      const {finished} = await super.sync();

      const latest_meta_content = await this.generator.generate();
      const latest_meta_content_hash = SemanticFile.contentHash(latest_meta_content);

      if (finished.length) {
        const previous_meta_file = this.latest;
        const previous_meta_file_hash = SemanticFile.contentHash(previous_meta_file);

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
      SemanticFile.write(latest_meta_filename, latest_meta_content);
      return await this.sync();
    } catch (e) {
      if (this.debug) {
        console.log(e);
      }
      throw `Something unexpected happened when trying to sync. the meta-files.\nReason: ${e.message}`;
    }
  }

  set cron(pattern) {
    if (pattern) {
      this.job = new CronJob(pattern, async () => {
        console.log(`Meta-files sync. triggered by cron job at ${moment()}`);
        try {
          await this.sync();
        } catch (e) {
          console.error(`Meta-files sync. cron job FAILED at${moment()}`);
          console.error(e);
        }
      }, null, true, 'Europe/Brussels');
      console.log(`Meta-files sync. con job set-up for ${pattern}, have a nice day!`);
    }
  }

  get latest() {
    return this.getLatestFor(META_FILE_MATCHER);
  }
}