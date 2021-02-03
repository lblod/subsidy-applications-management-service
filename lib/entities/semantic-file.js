import { sparqlEscape } from 'mu';
import { APP_URI } from '../../env';
import { filenameToUri, uriToFilename } from '../util/file';
import { v5 as uuidv5 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';
import Base64 from 'crypto-js/enc-base64';
import sha256 from 'crypto-js/sha256';
import moment from 'moment';

const NAMESPACE = '77219b1e-e23d-4828-847f-55e2d7fac687'; // NOTE: used for consistent uuid generation based on the URI

export class SemanticFile {

  static exists(filename) {
    if (filename instanceof SemanticFile) {
      filename = filename.filename;
    }
    return fs.existsSync(filename);
  }

  static writeContent(filePOJO, content) {
    return fs.writeFileSync(filePOJO.filename, content);
  }

  static generateContentHash(content) {
    if (content instanceof SemanticFile) {
      content = content.content;
    }
    return Base64.stringify(sha256(content));
  }

  constructor({uri, filename, created = moment(), modified = moment(), publisher = APP_URI}) {
    this.physicalURI = uri ? uri : filenameToUri(filename);
    this.created = created;
    this.modified = modified;
    this.publisher = publisher;
  }

  get uri() {
    return this.physicalURI;
  }

  get uuid() {
    return uuidv5(this.physicalURI, NAMESPACE);
  }

  get virtualURI() {
    return `http://data.lblod.info/files/${this.uuid}`;
  }

  get filename() {
    return uriToFilename(this.physicalURI);
  }

  get extension() {
    return path.extname(this.filename);
  }

  /**
   * TODO:  this is hardcode for now, might consider a plugin later
   *        if media-types really start going beyond what is expected now.
   *
   * @returns {string}
   */
  get format() {
    switch (this.extension) {
      case '.json':
        return 'application/json';
      case '.ttl':
        return 'application/n-triples';
      case '.js':
        return 'application/javascript';
      default:
        return 'plain/text';
    }
  }

  get content() {
    switch (this.extension) {
      case '.json':
        return require(this.filename);
      case '.js':
        return require(this.filename);
      default:
        return fs.readFileSync(this.filename, 'utf8');
    }
  }

  toNT() {
    let buffer = [];
    const prefixes = [
      '@prefix nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#> .',
      '@prefix nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#> .',
      '@prefix mu: <http://mu.semte.ch/vocabularies/core/> .',
      '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
      '@prefix dbpedia: <http://dbpedia.org/resource/> .',
      '@prefix dct: <http://purl.org/dc/terms/> .',
    ];

    const escaped = {
      virtualURI: `<${this.virtualURI}>`,
      physicalURI: `<${this.physicalURI}>`,
      uuid: sparqlEscape(this.uuid, 'string'),
      filename: sparqlEscape(this.filename, 'string'),
      ext: sparqlEscape(this.extension, 'string'),
      format: sparqlEscape(this.format, 'string'),
      created: sparqlEscape(this.created.toISOString(), 'date'),
      modified: sparqlEscape(this.modified.toISOString(), 'date'),
      publisher: `<${this.publisher}>`,
    };

    buffer.push(prefixes.join('\n'));

    // NOTE: virtual copy off the file
    buffer.push(`${escaped.virtualURI} a nfo:FileDataObject .`);
    buffer.push(`${escaped.virtualURI} mu:uuid ${escaped.uuid} .`);
    buffer.push(`${escaped.virtualURI} nfo:fileName ${escaped.filename} .`);
    buffer.push(`${escaped.virtualURI} dct:format ${escaped.format}.`);
    buffer.push(`${escaped.virtualURI} dbpedia:fileExtension ${escaped.ext} .`);
    buffer.push(`${escaped.virtualURI} dct:created ${escaped.created} .`);
    buffer.push(`${escaped.virtualURI} dct:modified ${escaped.created} .`);
    buffer.push(`${escaped.virtualURI} dct:publisher ${escaped.publisher} .`);

    // NOTE: physical copy off the file
    buffer.push(`${escaped.physicalURI} a nfo:FileDataObject .`);
    buffer.push(`${escaped.physicalURI} nie:dataSource ${escaped.virtualURI}.`);
    buffer.push(`${escaped.physicalURI} nfo:fileName ${escaped.filename} .`);
    buffer.push(`${escaped.physicalURI} dct:format ${escaped.format}.`);
    buffer.push(`${escaped.physicalURI} dbpedia:fileExtension ${escaped.ext} .`);
    buffer.push(`${escaped.physicalURI} dct:created ${escaped.created} .`);
    buffer.push(`${escaped.physicalURI} dct:modified ${escaped.created} .`);

    return buffer.join('\n').trim();
  }

  toJSON() {
    return {
      uri: this.physicalURI,
      filename: this.filename,
      extension: this.extension,
      created: this.created,
      modified: this.created,
      source: {
        uri: this.virtualURI,
        extension: this.extension,
        created: this.created,
        modified: this.created,
        publisher: this.publisher,
      },
    };
  }
}