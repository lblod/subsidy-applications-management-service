import { getFiles } from '../../lib/util/file';
import { APP_URI, VERSIONED_FILES_ROOT, VERSIONED_FILES_WATCHER } from '../../env';
import { COMMON_GRAPHS, NTriplesMutationService } from '../../lib/services/n-triples-mutation-service';
import { query } from '../../lib/util/database';
import { VersionFile } from '../entities/version-file';
import moment from 'moment';
import groupBy from 'lodash.groupby';
import { sleep } from '../../lib/util/generic';
import { Gaze } from 'gaze';

const CONFIG_FILES_MATCHERS = [
  {
    key: 'config',
    match: '-config.json',
  },
  {
    key: 'form',
    match: '-form.ttl',
  },
];

const PUBLISHER = `${APP_URI}/versioned-files-service`;

/**
 * Services providing the *versioned-files.
 *
 * - versioned-files are the file dropped within the VERSIONED_FILES_ROOT.
 */
export class VersionedFilesService {

  constructor() {
    this.configurationFilesMap = {};
    this.mutationService = new NTriplesMutationService({sudo: true});

    // TODO watcher might be cool but also a headache
    if (VERSIONED_FILES_WATCHER) {
      this.gaze = new Gaze(`${VERSIONED_FILES_ROOT}/**`);
      this.gaze.on('all', async () => {
        await sleep(1000);
        await this.synchronize();
      });
    }
  }

  /**
   * Function that tries to synchronize the files saved in-store with the once saved on-disk.
   * Returns the newest versioned files as a filename to file map.
   *
   * @returns {Promise<object>}
   */
  async synchronize() {
    console.log(`Started sync. of versioned files @ ${moment().toISOString()} ...`);

    const onDisk = await getFilesOnDisk();
    const inStore = await getFilesInStore();

    // TODO make this error more generic (maybe move to another service)
    if (!onDisk.length) {
      const buffer = [];
      buffer.push('[WARNING] No versioned files found!\n');
      if (!inStore.length) {
        buffer.push('Is this your first time using the service? ');
        buffer.push('If so, make sure to drop versioned configuration files (like for ex: form.ttl) ');
        buffer.push('in the configured VERSIONED_FILES_ROOT.');
      } else {
        buffer.push('All configuration files that have been saved in-store are lost on-disk. ');
        buffer.push('Did something accidentally remove files in the root version route?');
      }
      throw buffer.join('');
    }

    let {finished, missing} = await this.doSync(onDisk, inStore);
    this.configurationFilesMap = groupBy(finished, file => file.created.toISOString());

    // NOTE: generate a report based on what has occurred, what the current state is
    finished = finished.map(file => new Object({status: 'DONE', file}));
    missing = missing.map(file => new Object({status: 'LOST', file}));

    const report = finished.concat(missing).sort((a, b) => a.file.created - b.file.created);
    if (report.length) {
      const buffer = report.map(line => `[${line.status}]\t${line.file.filename}`);
      console.log(buffer.join('\n'));
    }

    if (missing.length) {
      const buffer = [];
      buffer.push('[WARNING] Breaking changes detected!');
      buffer.push('Versioned files that have been saved in-store are removed from disk.');
      buffer.push(`Did something accidentally remove files in the root version route"?`);
      console.log(buffer.join('\n'));
    } else {
      console.log(`Sync. of versioned files succeeded @${moment().toISOString()}.`);
    }
    return this.getLatest();
  }

  /**
   *  [PRIVATE FUNCTION] use at your own discretion.
   *  Recursive function that goes through the files on-disk and tries to save/sync them up.
   *
   * @returns {Promise<{missing, finished}>}
   */
  async doSync(newbies, missing, finished = []) {
    while (newbies.length) {
      const newbie = newbies.shift();
      if (missing.find(lost => lost.uri === newbie.uri)) {
        finished.push(newbie);
        missing.splice(missing.findIndex(lost => lost.uri === newbie.uri), 1);
      } else {
        await this.mutationService.insert(COMMON_GRAPHS.public, newbie.toNT());
        finished.push(newbie);
        await this.doSync(newbies, missing, finished);
      }
    }
    return {
      missing,
      finished,
    };
  }

  /**
   * Function returns a map off the newest/latest versioned files.
   *
   * @returns {Promise<object>}
   */
  async getLatest() {
    const latest = Object.keys(this.configurationFilesMap).sort((a, b) => moment(b) - moment(a))[0];
    if (!latest) {
      return this.synchronize();
    }
    const map = {};
    this.configurationFilesMap[latest].forEach(file => {
      map[file.uri] = file;
    });
    return map;
  }

}

/* PRIVATE FUNCTION */

/**
 * Function retrieves the files on-disk that are off interest to this service
 *
 * @throws error if the filenames does not aether to the versioning format.
 * @returns {Promise<VersionFile[]>}
 */
async function getFilesOnDisk() {
  const filenames = await getFiles(VERSIONED_FILES_ROOT);
  return filenames.map(filename => new VersionFile({
    filename,
    publisher: PUBLISHER,
  }));
}

/**
 * Function retrieves the files in-store that are off interest to this service.
 *
 * @throws error if the filenames does not aether to the versioning format.
 * @returns {Promise<*>}
 */
async function getFilesInStore() {
  const response = await query(`
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?physical WHERE {
  ?virtual  a nfo:FileDataObject ;
            dct:publisher <${PUBLISHER}> .
  ?physical nie:dataSource ?virtual .
}`);
  return response.results.bindings.map(binding =>
      new VersionFile({
        uri: binding.physical.value,
      }),
  );
}