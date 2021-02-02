import { getFiles } from '../../lib/util/file';
import { APP_URI, META_DATA_ROOT, FILE_SYNC_WATCHER } from '../../env';
import { COMMON_GRAPHS, NTriplesMutationService } from '../../lib/services/n-triples-mutation-service';
import { query } from '../../lib/util/database';
import { VersionFile } from '../entities/version-file';
import moment from 'moment';
import groupBy from 'lodash.groupby';
import { sleep } from '../../lib/util/generic';
import { Gaze } from 'gaze';
import { FilePOJO } from '../entities/file-pojo';
import fs from 'fs';

/**
 * Services providing the *versioned-files.
 *
 * - versioned-files are the file dropped within the VERSIONED_FILES_ROOT.
 */
export class FileSyncService {

  constructor(publisher, root) {
    this.root = root;
    this.publisher = publisher;
    this.syncedMap = {};
    this.mutationService = new NTriplesMutationService({sudo: true});

    // TODO watcher might be cool but also a headache
    if (FILE_SYNC_WATCHER) {
      this.gaze = new Gaze(`${META_DATA_ROOT}/**`);
      this.gaze.on('all', async () => {
        await sleep(1000);
        await this.sync();
      });
    }
  }

  /**
   * Function that tries to synchronize the files saved in-store with the once saved on-disk.
   * Returns the newest versioned files as a filename to file map.
   *
   * @returns {Promise<object>}
   */
  async sync() {
    const onDisk = await this.getFilesOnDisk();
    const inStore = await this.getFilesInStore();
    let {finished, missing} = await this.doSync(onDisk, inStore);
    this.syncedMap = groupBy(finished, file => file.created.toISOString());

    // NOTE: gen. small console report on what occurred
    finished = finished.map(file => new Object({status: 'DONE', file}));
    missing = missing.map(file => new Object({status: 'LOST', file}));
    const report = finished.concat(missing).sort((a, b) => a.file.created - b.file.created);
    if (report.length) {
      const buffer = report.map(line => `[${line.status}]\t${line.file.filename}`);
      console.log(buffer.join('\n'));
    }

    return {finished, missing};
  }

  /**
   * Function returns an array off the newest/latest versioned files.
   *
   * @returns {array}
   */
  getLatest() {
    const latest = Object.keys(this.syncedMap).sort((a, b) => moment(b) - moment(a))[0];
    if (!latest) {
      throw 'an uptsie';
      // return await this.synchronize();
    }
    return this.syncedMap[latest];
  }

  // TODO not safe enough yet
  getLatestFor(matcher) {
    const matches = this.getLatest().filter(file => file.filename.includes(matcher));
    if (matches === 0) {
     return undefined;
    }
    if (matches > 1) {
      return undefined;
    }
    return matches[0];
  }

  /** [PRIVATE FUNCTIONS] use at your own discretion.**/

  /**
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

  async getFilesOnDisk() {
    const filenames = await getFiles(this.root);
    return filenames.map(filename => new FilePOJO({
      filename,
      created: moment(fs.statSync(filename).ctime),
      modified: moment(fs.statSync(filename).ctime),
      publisher: this.publisher,
    }));
  }

  async getFilesInStore() {
    const response = await query(`
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?physical WHERE {
  ?virtual  a nfo:FileDataObject ;
            dct:publisher <${this.publisher}> .
  ?physical nie:dataSource ?virtual .
}`);
    return response.results.bindings.map(binding =>
        new FilePOJO({
          uri: binding.physical.value,
        }),
    );
  }
}


