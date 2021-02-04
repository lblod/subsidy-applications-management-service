import { SERVICE_URI, DEBUG_LOGS, META_DATA_ROOT, META_DATA_CRON } from '../../env';
import moment from 'moment';
import { SemanticFile } from '../entities/semantic-file';
import { v4 as uuidv4 } from 'uuid';
import { MetaDataExtractor } from './meta-data-extractor';
import { SemanticFileSync } from './semantic-file-sync';
import { CronJob } from 'cron';

const PUBLISHER = `${SERVICE_URI}/meta-files`;
const MAX_RETRIES = 10;

export const META_FILE_MATCHER = '-meta.ttl';

/**
 * Service providing the up-to-date and synced-up meta-file(s)
 */
export class MetaFiles extends SemanticFileSync {

  constructor(config_files) {
    super(PUBLISHER, META_DATA_ROOT);
    this.config_files = config_files;
    this.cron = META_DATA_CRON;
    this.debug = true;
  }

  /**
   * Initialization off the service.
   */
  async init() {
    await this.sync();
    return this;
  }

  /**
   * Returns the latest meta-file
   *
   * @returns {undefined|SemanticFile}
   */
  get latest() {
    return this.getLatestFor(META_FILE_MATCHER);
  }

  /**
   * Synchronize the meta-files saved in-store with the once saved on-disk.
   * Added functionality => generates meta-files:
   *    1) nothing on disk
   *    2) newly extracted meta-data is different than what was last saved.
   *
   * @returns {Promise<SemanticFile>}
   */
  async sync() {
    try {
      const start = moment();
      console.log(`Started sync. of meta-files @ ${moment()} ...`);
      const {finished} = await super.sync();
      const latest = await this.update(finished);
      const end = moment();
      console.log(
          `Sync. of meta files succeeded @ ${end}. That took me only ${moment.duration(start.diff(end)).humanize()}!`);
      return latest;
    } catch (e) {
      console.error(e);
      throw `Something unexpected happened when trying to sync. the meta-files.\nReason: ${e.message}`;
    }
  }

  async update(meta_files, attempt = 0) {
    attempt += 1;
    if (attempt > MAX_RETRIES) throw 'Max amount off meta-data generation retries was reached';
    const schemes = this.config_files.config.content.meta['concept-schemes'];
    const latest_meta_content = await new MetaDataExtractor().extract(schemes);
    const latest_meta_content_hash = SemanticFile.contentHash(latest_meta_content);
    if (meta_files.length) {
      const previous_meta_file = this.latest;
      const previous_meta_file_hash = SemanticFile.contentHash(previous_meta_file);

      // NOTE: if the hashes match up we assume nothing has changed
      if (latest_meta_content_hash === previous_meta_file_hash) {
        return previous_meta_file_hash;
      }
    }
    const latest_meta_filename = `${META_DATA_ROOT}${uuidv4()}${META_FILE_MATCHER}`;
    console.log(`[NEW]  ${latest_meta_content}`);
    SemanticFile.write(latest_meta_filename, latest_meta_content);
    await this.update(meta_files, attempt);
  }

  /**
   * Setup a cron-job to sync-up meta-files for the given pattern.
   *
   * @param pattern
   */
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
}