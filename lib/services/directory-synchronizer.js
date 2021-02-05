import { getFiles } from '../util/file';
import { NTriplesMutator } from './n-triples-mutator';
import { query } from '../util/database';
import moment from 'moment';
import groupBy from 'lodash.groupby';
import { SemanticFile } from '../entities/semantic-file';
import { SERVICE_URI } from '../../env';
import { VersionFile } from '../entities/version-file';

/**
 * Abstract service providing basic synchronization between files on-disk and in-store
 */
export class DirectorySynchronizer {

  constructor(root) {
    this.debug = false;
    this.root = root;
    this.publisher = `${SERVICE_URI}${root}`;
    this.files = [];
    this.mutator = new NTriplesMutator();
  }

  /**
   * Synchronize the files saved in-store with the once saved on-disk.
   *
   * @returns {Promise<{missing, finished}>}
   */
  async sync() {
    const onDisk = await this.getSemanticFilesOnDisk();
    const inStore = await this.getSemanticFilesInStore();
    let {finished, missing} = await this.doSync(onDisk, inStore);

    // NOTE: we group the found files locally by creation date
    this.files = finished;

    // NOTE: gen. small console report on what occurred
    if (this.debug) {
      const rf = finished.map(file => new Object({status: 'DONE', file}));
      const rm = missing.map(file => new Object({status: 'LOST', file}));
      const report = rf.concat(rm).sort((a, b) => a.file.created - b.file.created);
      if (report.length) {
        const buffer = report.map(line => `[${line.status}]\t${line.file.filename}`);
        console.log(buffer.join('\n'));
      }

      if (missing.length) {
        console.warn(
            `[WARNING] Breaking changes detected! Files that were stored have disappeared from: ${this.root}.`);
      }
    }

    return {finished, missing};
  }

  /**
   * Returns an array off the latest files based on creation date.
   *
   * @returns {array}
   */
  getLatest() {
    const createdMap = groupBy(this.files, file => file.created.toISOString());
    const latest = Object.keys(createdMap).sort((a, b) => moment(b) - moment(a))[0];
    if (!latest) {
      return [];
    }
    return createdMap[latest];
  }

  /**
   * Helper function to find the latest file for the given "matcher"
   *
   * @param matcher
   *
   * @returns {undefined|SemanticFile}
   */
  getLatestFor(matcher) {
    return this.getLatest().find(file => file.filename.includes(matcher));
  }

  /** [PRIVATE FUNCTIONS] use at your own discretion.**/

  /**
   * Recursive function that goes through the "newbies" and tries to pair them up with the "missing"
   * until no "newbies" can be found anymore.
   *
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
        await this.mutator.insert(newbie.toNT());
        finished.push(newbie);
        await this.doSync(newbies, missing, finished);
      }
    }
    return {
      missing,
      finished: finished,
    };
  }

  /**
   * Retrieve the files on disk.
   *
   * @returns {Promise<SemanticFile[]>}
   */
  async getSemanticFilesOnDisk() {
    const filenames = await getFiles(this.root);
    return filenames.map(filename => new VersionFile({
      filename,
      publisher: this.publisher,
    }));
  }

  /**
   * Retrieve the files in store.
   *
   * @returns {Promise<*>}
   */
  async getSemanticFilesInStore() {
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
        new SemanticFile({
          uri: binding.physical.value,
        }),
    );
  }
}


