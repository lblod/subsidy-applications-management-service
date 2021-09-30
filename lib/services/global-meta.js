import {
  DEBUG_LOGS,
  META_DATA_CRON,
  META_DATA_EXTRACTION_BACKOFF_INITIAL_WAIT,
  META_DATA_EXTRACTION_BACKOFF_MAX_WAIT,
  META_DATA_EXTRACTION_BACKOFF_RATE,
  META_DATA_ROOT, META_DATA_STALE_CRON_STOP,
} from '../../env';
import { mkDirIfNotExistsSync } from '../util/file';
import { DirectorySynchronizer } from './directory-synchronizer';
import { CronJob } from 'cron';
import moment from 'moment';
import { VersionedFile } from '../entities/versioned-file';
import { META_FILE_MATCHER } from '../entities/semantic-form-meta';
import { SemanticFile } from '../entities/semantic-file';
import { MetaDataExtractor } from './meta-data-extractor';
import { sleep } from '../util/generic';

export class GlobalMeta {

  /**
   * Returns if a given {@link SemanticFormConfiguration} is eligible for global-meta generation.
   *
   * @param configuration
   * @returns {boolean}
   */
  static isEligible(configuration) {
    return configuration.specification.schemes.length > 0;
  }

  constructor({configuration, root = META_DATA_ROOT, cron = META_DATA_CRON} = {}) {
    this.job = undefined;
    this.root = root;
    this.cron = cron;
    this.started = undefined;
    this.triggered = undefined;
    this.configuration = configuration;
    this.files = new DirectorySynchronizer(this.root);
    mkDirIfNotExistsSync(this.root);
  }

  async init() {
    await this.files.sync();
    return this;
  }

  /**
   * Returns the latest meta-file
   *
   * @returns {undefined|SemanticFile}
   */
  get latest() {
    return this.files.getLatestFile(META_FILE_MATCHER);
  }

  /**
   * Triggers CRON job to generate meta-data.
   * Added functionality:
   *  1) if CRON stale (not being used), stops the process
   *
   * @returns {Promise<void>}
   */
  async trigger() {
    // NOTE we set the start date.
    this.triggered = moment();

    // NOTE we explicitly update ourself, to ensure we have update meta-data ready.
    if (!this.started) {
      console.log(`(re)starting job to generate global meta-data for ${this.root}`);
      this.started = moment();
      await this.update();
      // NOTE if no job was made, we created yet, we create it.
      if (!this.job) {
        console.log(`Spawning job to generate global meta-data for ${this.root}`);
        this.job = new CronJob(this.cron, async () => {
          console.log(`Global meta-data update for ${this.root} triggered by cron job at ${moment()}`);
          try {
            await this.update();
          } catch (e) {
            /**
             * TODO: silent exception.
             *       Fail of the meta-data generation/update process.
             *       This could cause out-of-date meta-date, resulting in the wrong data shown to the client.
             */
            console.warn(`Global meta-data update for ${this.root} FAILED.`);
            console.log(e);
          }
        }, null, false, 'Europe/Brussels');
        this.job.addCallback(async () => {
          console.log(moment().diff(this.triggered, 'days'));
          if (moment().diff(this.triggered, 'days') >= META_DATA_STALE_CRON_STOP) {
            console.log(
                `Global meta-data update for ${this.root} STOPPED\nReason: stale meta-data, hasn't been triggered withing 5 days.`);
            this.started = undefined; // NOTE reset started time.
            this.job.stop();
          }
        });
      }
      this.job.start();
    }
  }

  /**
   * Synchronize the meta-files saved in-store with the once saved on-disk.
   * Added functionality, generates meta-files:
   *    1) if nothing on disk
   *    2) if newly extracted meta-data is different than what was last saved.
   *
   * @returns {Promise<SemanticFile>}
   */
  async update() {
    // NOTE: we set the previous meta-data (contents of the latest meta-file)
    let previous = '';
    if (this.files.files.length)
      previous = this.latest.content;

    const schemes = this.configuration.specification.schemes;
    const {latest, attempt} = await extractMetaDataBackOff({schemes, previous});

    // NOTE: if attempts > 0 we know that the meta-data changed, so we save it
    if (attempt) {
      const filename = `${this.root}${VersionedFile.timestamp()}${META_FILE_MATCHER}`;
      if (DEBUG_LOGS)
        console.log(`Creating new meta-file: ${filename}`);
      SemanticFile.write(filename, latest);
      await this.files.sync();
    }
    return this.latest;
  }

  toJSON() {
    return this.latest;
  }

}

/* PRIVATE FUNCTIONS */

/**
 * Extracts meta-data for the given schemes.
 * Added functionality:
 *  1) if newly extracted meta-data is different from latest saved on disk, we try again (make sure data is stable)
 *  2) if data is unstable (ex: in migration) we back-off and await, try again later.
 *
 * @param schemes
 * @param previous
 * @param attempt
 * @returns {Promise<{attempt: number, latest: string}|*|undefined>}
 */
async function extractMetaDataBackOff({schemes, previous = '', attempt = 0} = {}) {
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
    return await extractMetaDataBackOff({schemes, previous: latest, attempt});
  } else {
    const wait = moment.duration(META_DATA_EXTRACTION_BACKOFF_MAX_WAIT);
    console.warn(`Max retries of ${wait.humanize()} was reached`);
    throw `Creation off meta-data failed. Reason: meta-data is unstable, are the migrations running?`;
  }
}