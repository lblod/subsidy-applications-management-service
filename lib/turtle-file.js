import { sparqlEscapeDateTime } from 'mu';

import moment from 'moment';

import { v5 as uuidv5 } from 'uuid';
import { extname } from 'path';

import { isSubject, update } from './util/database';
import { APP_URI } from '../env';

// NOTE used for consistent uuid generation
const NAMESPACE = 'd96f7f16-75cc-430e-89cf-dc9c024321b0';

const TIMESTAMP_FORMAT = 'YYYYMMDDhhmmss'

// TODO looking for a more fitting name
export class TurtleFile {

  constructor({uri, filepath, type}) {
    this._uri = uri? uri : filepath.replace('/share/', 'share://');
    this._type = type;
    if(this.extension !== '.ttl') {
      throw `Couldn't creat TurtleFile for ${this.filename}, as it is not a ttl file.`
    }
    if(this.timestamp === '' || this.timestamp.length !== 14){
      throw `Couldn't creat TurtleFile for ${this.filename}, as it did not contain a valid timestamp \`${TIMESTAMP_FORMAT}\`.`
    }
  }

  get uri() {
    return this._uri;
  }

  get filepath() {
    return this.uri.replace('share://', '/share/');
  }

  get filename() {
    return this.uri.replace(/^.*[\\\/]/, '');
  }

  get extension() {
    return extname(this.filename);
  }

  get format() {
    return 'text/turtle';
  }

  get timestamp() {
    return this.filename.match(/^(\d){0,14}/)[0];
  }
  get created() {
    return moment(this.timestamp, TIMESTAMP_FORMAT);
  }

  get json() {
    return {
      type: 'turtle-file',
      id: '1',
      attributes: {
        uri: this._uri,
        created: this.created
      },
    }
  }

  async sync() {
    if (!await isSubject(this.uri, {sudo: true})) {
      console.log(`Couldn't find ${this.uri}, saving ...`);
      await this.save();
    } else {
      console.log(`File <${this.uri}> has been stored, nothing should happen`);
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
    <${this.uri}> a nfo:FileDataObject ${this._type ? `<${this._type}>` : ''} ;
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

  async content() {
    return await fs.readFile(this.filepath, 'utf8');
  }
}