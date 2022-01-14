import {sparqlEscape} from 'mu';
import { getFiles } from '../util/file';
import {COMMON_GRAPHS, NTriplesMutator} from './n-triples-mutator';
import { query } from '../util/database';
import moment from 'moment';
import groupBy from 'lodash.groupby';
import { SemanticFile } from '../entities/semantic-file';
import { SERVICE_URI } from '../../env';
import { VersionedFile } from '../entities/versioned-file';

/**
 * Abstract service providing basic synchronization between files on-disk and in-store
 */
export class DirectorySynchronizer {

  constructor(root) {
    this.root = root;
    this.publisher = `${SERVICE_URI}${root}`;
    this.files = [];
    this.filesByCreated = undefined;
    this.mutator = new NTriplesMutator({sudo:true});
  }

  async init(){
    await this.sync();
    return this;
  }

  /**
   * Synchronize the files saved in-store with the once saved on-disk.
   *
   * NOTE: stores files on the PUBLIC graph
   *
   * @returns {Promise<{missing, processed}>}
   */
  async sync() {
    const onDisk = await this.getSemanticFilesOnDisk();
    const inStore = await this.getSemanticFilesInStore();
    let {processed, missing} = await this.doSync(onDisk, inStore);

    this.files = processed;

    // NOTE: we group the found files locally by creation date
    this.filesByCreated = groupBy(this.files, file => file.created.toISOString());

    // NOTE: gen. small console report on what occurred
    const rf = processed.map(file => new Object({status: 'DONE', file}));
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

    return {processed, missing};
  }

  /**
   * Returns an array of the latest files based on creation date.
   *
   * @returns {array}
   */
  getLatestFiles() {
    const latest = Object.keys(this.filesByCreated).sort((a, b) => moment(b) - moment(a))[0];
    if (!latest) {
      return [];
    }
    return this.filesByCreated[latest];
  }

  /**
   * Helper function to find the latest file for the given "matcher"
   *
   * @param matcher
   *
   * @returns {undefined|SemanticFile}
   */
  getLatestFile(matcher) {
    return this.getLatestFiles().find(file => file.filename.includes(matcher));
  }

  /** [PRIVATE FUNCTIONS] use at your own discretion.**/

  /**
   * Recursive function that goes through the "newbies" and tries to pair them up with the "missing"
   * until no "newbies" can be found anymore.
   *
   *
   * @returns {Promise<{missing, processed}>}
   */
  async doSync(newbies, missing, processed = []) {
    while (newbies.length) {
      const newbie = newbies.shift();
      if (missing.find(lost => lost.uri === newbie.uri)) {
        processed.push(newbie);
        missing.splice(missing.findIndex(lost => lost.uri === newbie.uri), 1);
      } else {
        await this.mutator.insert(newbie.toNT(), COMMON_GRAPHS.public);
        processed.push(newbie);
        await this.doSync(newbies, missing, processed);
      }
    }
    return {
      missing,
      processed,
    };
  }

  /**
   * Retrieve the files on disk.
   *
   * @returns {Promise<SemanticFile[]>}
   */
  async getSemanticFilesOnDisk() {
    const filenames = await getFiles(this.root);
    return filenames.map(filename => new VersionedFile({
      filename,
      publisher: this.publisher,
    }));
  }

  /**
   * Retrieve the files in store.
   *
   * TODO: redo with proper escape for URI
   *
   * @returns {Promise<*>}
   */
  async getSemanticFilesInStore() {
    const response = await query(`PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?physical WHERE {
  GRAPH ${sparqlEscape(COMMON_GRAPHS.public, 'uri')} {
    ?virtual  a nfo:FileDataObject ;
              dct:publisher <${this.publisher}> .
    ?physical nie:dataSource ?virtual .
  }
}`, true);
    return response.results.bindings.map(binding =>
        new SemanticFile({
          uri: binding.physical.value,
        }),
    );
  }
}


