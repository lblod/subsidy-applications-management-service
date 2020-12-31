import { sparqlEscapeDateTime } from 'mu';

import moment from 'moment';
import fs from 'fs';

import { v5 as uuidv5 } from 'uuid';

import { update } from '../util/database';
import { APP_URI } from '../../env';


const NAMESPACE = 'd96f7f16-75cc-430e-89cf-dc9c024321b0'; // NOTE used for consistent uuid generation
const TIMESTAMP_FORMAT = 'YYYYMMDDhhmmss';

export class VersionDirectory {

  constructor({uri, path}) {
    this._uri = uri ? uri : path.replace('/share/', 'share://');
    if(!fs.existsSync(this.path)) {
      throw Error(`given path '${this.path}' doesn't exist, did you accidentally remove it?`);
    }
    if(!fs.lstatSync(this.path).isDirectory()){
      throw Error(`given path '${this.path}' is not a directory`);
    }
    if (this.timestamp === '' || this.timestamp.length !== 14) {
      throw Error(`Name name did not contain a valid timestamp.\nExpected: \"${TIMESTAMP_FORMAT}-description\"`);
    }
  }

  get uri() {
    return this._uri;
  }

  get path() {
    return this.uri.replace('share://', '/share/');
  }

  get filename(){
    return this.uri.replace(/^.*[\\\/]/, '');
  }

  get timestamp() {
    return this.filename.match(/^(\d){0,14}/)[0];
  }

  get created() {
    return moment(this.timestamp, TIMESTAMP_FORMAT);
  }

  get json() {
    return {
      type: 'version-directory',
      id: '1',
      attributes: {
        uri: this._uri,
        created: this.created
      },
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
    <${this.uri}> a nfo:Folder, nfo:DataContainer;
      mu:uuid "${uuidv5(this.uri, NAMESPACE)}" ;
      nfo:fileName "${this.filename}" ;
      dct:publisher <${APP_URI}> ;
      dct:created ${sparqlEscapeDateTime(this.created.toISOString())} ;
      dct:modified ${sparqlEscapeDateTime(this.created.toISOString())} .
  }
}`);
  }
}