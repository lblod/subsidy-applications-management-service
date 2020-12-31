import fs from 'fs';
import { VersionDirectory } from './version-directory';
import { query } from '../util/database';
import { APP_URI, FORM_VERSION_DIRECTORY } from '../../env';

export class VersionService {

  constructor() {
    this._active = undefined;
    fs.watch(FORM_VERSION_DIRECTORY, () => this.sync()); // NOTE: watches for changes in the root version directory
  }

  async init(){
    await this.sync();
    return this;
  }

  get active() {
    if (this._active) {
      return this._active;
    }
    throw {
      status: 404,
      message: `Could not find an active directory, are you sure to have created version directories in ${FORM_VERSION_DIRECTORY}`,
    };

  }

  /**
   * TODO
   */
  async sync() {
    // NOTE: Get all the version directories within the root version directory (ON DISK) ...
    const onDisk = getVersionDirectoriesOnDisk();

    // NOTE: Get all the version directories saved in store (also returns lost directories, directories that couldn't be processed)
    const {inStore, lost} = await getVersionDirectoriesInStore();

    // NOTE: filter out the newly created directories (on disk BUT not in store)
    const newbies = onDisk.filter(i => !inStore.find(j => j.uri === i.uri));


    // NOTE: Process new directories
    if (newbies.length) {
      for (let dir of newbies) {
        try {
          await dir.save();
        } catch (e) {
          console.warn(`Something unexpected went wrong while trying to sync "${dir.filename}":`);
          console.warn(e);
        }
      }
    }

    // NOTE: Process lost directories
    if (lost.length) {
      console.warn('directories where lost!');
      lost.forEach(dir => {
        console.warn(`- ${dir.uri}\n  Reason: ${dir.e.message}`);
      })
    }

    // NOTE: Process active directory
    try {
      this._active = await getActiveDirectory();
    } catch (e) {
      console.warn(`Couldn't set the active directory, reverting ...\nReason: ${e.message}`);
    }
    console.log(`Active directory: <${this._active && this._active.uri}>`);
  }

}

/* PRIVATE FUNCTIONS */

/**
 * Returns all the version directories with the root version directory folder.
 */
function getVersionDirectoriesOnDisk() {
  let dirs = [];
  for (const dir of fs.readdirSync(FORM_VERSION_DIRECTORY, {withFileTypes: true})) {
    try {
      dirs.push(new VersionDirectory({path: `${FORM_VERSION_DIRECTORY}${dir.name}`}));
    } catch (e) {
      console.warn(`Couldn't create VersionDirectory for "${dir.name}" and will be ignored:\nReason: ${e.message}`);
    }
  }
  return dirs.sort((a, b) => a.created - b.created);
}

async function getVersionDirectoriesInStore() {
  const response = await query(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?subject WHERE {
  ?subject a nfo:Folder, nfo:DataContainer ;
           dct:publisher <${APP_URI}> .
}`);

  let inStore = [];
  let lost = [];

  for (const binding of response.results.bindings) {
    try {
      inStore.push(new VersionDirectory({uri: binding.subject.value}));
    } catch (e) {
      lost.push({
        uri: binding.subject.value,
        e
      });
    }
  }
  return {inStore: inStore.sort((a, b) => a.created - b.created), lost};
}

async function getActiveDirectory() {
  const response = await query(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?subject WHERE {
  ?subject a nfo:Folder, nfo:DataContainer ;
           dct:publisher <${APP_URI}> ;
           dct:created ?created .
} 
ORDER BY DESC (?created) LIMIT 1
  `);
  if (response.results.bindings.length) {
      return new VersionDirectory({uri: response.results.bindings[0].subject.value});
  }
}