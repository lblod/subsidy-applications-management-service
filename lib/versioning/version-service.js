import fs from 'fs';
import { VersionDirectory } from './version-directory';
import { query } from '../util/database';
import { APP_URI } from '../../env';

// TODO move to env vars
const VERSION_DIRECTORY_ROOT = '/share/versions/';

export class VersionService {

  constructor() {
    this._active = undefined;
    // NOTE watches for changes in the root version directory
    fs.watch(VERSION_DIRECTORY_ROOT, () => this.sync())
  }

  /**
   * TODO
   *  function will return the currently active form folder containing all the files needed for form construction:
   *   - form.ttl
   *   - meta.ttl
   *   - config.json
   */
  get active() {
    if (this._active) {
      return this._active;
    }
    throw {
      status: 404,
      message: `Could not find an active directory, are you sure to have created version directories in ${VERSION_DIRECTORY_ROOT}`,
    };

  }

  /**
   * TODO
   */
  async sync() {
    // NOTE: Get all the version directories within the version directory (ON DISK) ...
    const onDisk = getVersionDirectoriesOnDisk();

    // NOTE: Get all the version directories saved in store (also returns lost directories)
    const {inStore, lost} = await getVersionDirectoriesInStore();

    // NOTE: filter out the newly created directories (by the user)
    const newbies = onDisk.filter(i => !inStore.find(j => j.uri === i.uri));


    // NOTE: Process new directories
    if (newbies.length) {
      console.log(`${newbies.length} new directories found:`);  // TODO remove
      newbies.forEach(file => console.log(`- ${file.filename}`)); // TODO remove
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
      console.warn(`Couldn't set the active directory:\nReason: ${e.message}`);
    }
  }

}

/* PRIVATE FUNCTIONS */

/**
 * Returns all the version directories with the root version directory folder.
 */
function getVersionDirectoriesOnDisk() {
  let dirs = [];
  for (const dir of fs.readdirSync(VERSION_DIRECTORY_ROOT, {withFileTypes: true})) {
    try {
      dirs.push(new VersionDirectory({path: `${VERSION_DIRECTORY_ROOT}${dir.name}`}));
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
  // TODO update permissions
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
  `, true);
  if (response.results.bindings.length) {
      return new VersionDirectory({uri: response.results.bindings[0].subject.value});
  }
}