import moment from 'moment';

import { SemanticFile } from './semantic-file';

const TIMESTAMP_FORMAT = 'YYYYMMDDhhmmss';
const TIMESTAMP_REGEX = /(\d{14})(?!.*\d{14})/;

/**
 *  Class representation of a versioned file.
 */
export class VersionedFile extends SemanticFile {

  static timestamp(date = undefined){
    if(date) {
      return date.format(TIMESTAMP_FORMAT);
    }
    return moment(date).format(TIMESTAMP_FORMAT);
  }

  static copy(filePOJO) {
    return new VersionedFile({
      uri: filePOJO.uri,
      publisher: filePOJO.publisher,
    });
  }

  constructor({uri, filename, publisher}) {
    super({uri, filename, publisher});
    const match = this.filename.match(TIMESTAMP_REGEX);
    if (!match) {
      throw `${filename} did not contain a valid timestamp. Expected: \"${TIMESTAMP_FORMAT}-label${this.extension}\"`;
    }
    this.created = moment(match[0], TIMESTAMP_FORMAT);
    this.modified = moment(match[0], TIMESTAMP_FORMAT);
  }

}