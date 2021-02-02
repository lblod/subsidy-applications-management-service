import moment from 'moment';

import { FilePOJO } from './file-pojo';

const TIMESTAMP_FORMAT = 'YYYYMMDDhhmmss';
const TIMESTAMP_REGEX = /(\d{14})(?!.*\d{14})/;

export class VersionFile extends FilePOJO {

  static copy(filePOJO) {
    return new VersionFile({
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