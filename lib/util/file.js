import fs from 'fs-extra';
import moment from 'moment';

import { sparqlEscapeDateTime} from 'mu';
import { resolve, extname } from 'path';
import { v5 as uuidv5 } from 'uuid';

import { isSubject, update } from './database';
import { APP_URI } from '../../env';

// NOTE used for consistent uuid generation
const NAMESPACE = 'd96f7f16-75cc-430e-89cf-dc9c024321b0';

export class FileData {

  static pathToUri(path) {
    return path.replace('/share/', 'share://');
  }

  constructor(uri) {
    this.uri = uri;
  }

  get filepath() {
    return this.uri.replace('share://', '/share/');
  }

  get extension() {
    return extname(this.filename);
  }

  get format(){
    switch(this.extension) {
      case '.ttl':
        return 'text/turtle';
      default:
        return 'text/plain';
    }
  }

  get filename() {
    return this.uri.replace(/^.*[\\\/]/, '')
  }

  get created() {
    return getTimeStamp(this.filename); // TODO this could not be the case, what then?
  }

  async sync() {
    if (!await isSubject(this.uri, {sudo: true})) {
      console.log(`Couldn't find ${this.uri}`);
      await this.save();
    } else {
      console.log(`File has been stored ${this.uri}`);
    }
  }

  async save() {
    await update(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dbpedia: <http://dbpedia.org/resource/>
PREFIX dct: <http://purl.org/dc/terms/>

INSERT DATA {
  GRAPH <http://mu.semte.ch/graphs/public> {
    <${this.uri}> a nfo:FileDataObject ;
      mu:uuid "${uuidv5(this.uri, NAMESPACE)}" ;
      nfo:fileName "${this.filename}" ;
      dct:format "${this.format}" ;
      dbpedia:fileExtension "${this.extension}" ;
      dct:publisher <${APP_URI}> ;
      dct:created ${sparqlEscapeDateTime(this.created.toISOString())} ;
      dct:modified ${sparqlEscapeDateTime(this.created.toISOString())} .
  }
}`);
  }
}

/**
 * all helpers for working with files
 */

/**
 * Returns the content for the given file URI
 *
 * @param uri of the file to get the content for
 */
export async function getFileContent(uri) {
  const path = uri.replace('share://', '/share/');
  return await fs.readFile(path, 'utf8');
}

export async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

export function getTimeStamp(name) {
  const timestamp = name.match(/^(\d){0,14}/)[0]; // TODO make more solid
  return moment(timestamp, 'YYYYMMDDhhmmss');
}