import {
  DEBUG_LOGS,
  META_DATA_ROOT,
  META_DATA_CRON,
  META_DATA_EXTRACTION_BACKOFF_INITIAL_WAIT,
  META_DATA_EXTRACTION_BACKOFF_RATE, META_DATA_EXTRACTION_BACKOFF_MAX_WAIT,
} from '../../env';
import moment from 'moment';
import { SemanticFile } from '../entities/semantic-file';
import { v4 as uuidv4 } from 'uuid';
import { MetaDataExtractor } from './meta-data-extractor';
import { DirectorySynchronizer } from './directory-synchronizer';
import { CronJob } from 'cron';
import { sleep } from '../util/generic';
import { VersionedFile } from '../entities/versioned-file';

export const META_FILE_MATCHER = '-meta.ttl';

/**
 * Service providing the up-to-date and synced-up meta-file(s)
 */
export class MetaFiles {

  constructor(configuration) {
    this.configuration = configuration;
    this.directory = new DirectorySynchronizer(META_DATA_ROOT);
    this.cron = META_DATA_CRON;
    this.job = undefined;
  }

  /**
   * Initialization of the service.
   */
  async init() {
    await this.directory.sync();
    await this.sync();
    return this;
  }

  /**
   * Returns the latest meta-file
   *
   * @returns {undefined|SemanticFile}
   */
  get latest() {
    return this.directory.getLatestFile(META_FILE_MATCHER);
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

  /**
   * Synchronize the meta-files saved in-store with the once saved on-disk.
   * Added functionality => generates meta-files:
   *    1) nothing on disk
   *    2) newly extracted meta-data is different than what was last saved.
   *
   * @returns {Promise<SemanticFile>}
   */
  async sync() {
    const start = moment();
    console.log(`Started synchronizing meta-files at ${moment()} ...`);

    // NOTE: we set the previous meta-data (contents of the latest meta-file)
    let previous = '';
    if (this.directory.files.length)
      previous = this.latest.content;

    const {latest, attempt} = await this.extractMetaDataBackOff(previous);

    // NOTE: if attempts > 0 we now that the meta-data changed, so we save it
    if (attempt) {
      const filename = `${META_DATA_ROOT}${VersionedFile.timestamp()}--${uuidv4()}-${META_FILE_MATCHER}`;
      if (DEBUG_LOGS)
        console.log(`Creating new meta-file: ${filename}`);
      SemanticFile.write(filename, latest);
      await this.directory.sync();
    }

    const end = moment();
    const diff = moment.duration(start.diff(end));
    console.log(`Synchronization of the meta-files succeeded at ${end}. That took me only ${diff.humanize()}!`);
    return this.latest;
  }

  async extractMetaDataBackOff(previous = '', attempt = 0) {
    const schemes = this.configuration.specification.schemes;
    const latest = await new MetaDataExtractor().extract(schemes);
    if (SemanticFile.contentHash(latest) === SemanticFile.contentHash(previous)) {
      return {
        latest,
        attempt,
      };
    }
    // NOTE: to ensure we are not updating in the mitts of a migration/update we wait and try again.
    const timeout = Math.round(
        (META_DATA_EXTRACTION_BACKOFF_INITIAL_WAIT * Math.pow(1 + META_DATA_EXTRACTION_BACKOFF_RATE, attempt)));
    if (timeout < META_DATA_EXTRACTION_BACKOFF_MAX_WAIT) {
      ++attempt;
      if (DEBUG_LOGS) {
        console.warn(`Changes were detected to the meta-data ...`);
        console.warn(`Retrying extraction in ${moment.duration(timeout).humanize()}, attempt ${attempt}`);
      }
      await sleep(timeout);
      return await this.extractMetaDataBackOff(latest, attempt);
    } else {
      throw `Max retries of ${moment.duration(META_DATA_EXTRACTION_BACKOFF_MAX_WAIT).humanize()} was reached.`;
    }
  }
}