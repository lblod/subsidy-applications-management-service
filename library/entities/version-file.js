import moment from 'moment';

import { FilePOJO } from './file-pojo';
import fs from 'fs-extra';

const TIMESTAMP_FORMAT = 'YYYYMMDDhhmmss';
const TIMESTAMP_REGEX = /(\d{14})(?!.*\d{14})/;

export class VersionFile extends FilePOJO {

  constructor({uri, filename, created, modified, publisher}) {
    super({uri, filename, created, modified, publisher});
    const match = this.filename.match(TIMESTAMP_REGEX);
    if (!match) {
      throw `${filename} did not contain a valid timestamp. Expected: \"${TIMESTAMP_FORMAT}-label${this.extension}\"`;
    }
    this.created = moment(match[0], TIMESTAMP_FORMAT);
    this.modified = moment(match[0], TIMESTAMP_FORMAT);
  }

}