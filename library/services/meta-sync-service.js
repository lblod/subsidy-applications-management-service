import { FileSyncService } from './file-sync-service';
import { APP_URI, META_DATA_ROOT } from '../../env';
import moment from 'moment';
import Base64 from 'crypto-js/enc-base64';
import sha256 from 'crypto-js/sha256';
import { FilePOJO } from '../entities/file-pojo';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { MetaGenService } from './meta-gen-service';

const PUBLISHER = `${APP_URI}/meta-sync-service`;

export class MetaSyncService extends FileSyncService {

  constructor(configSyncService) {
    super(PUBLISHER, META_DATA_ROOT);
    this.service = new MetaGenService(configSyncService);
  }

  async init() {
    await this.sync();
    return this;
  }

  // TODO THIS GOES BAD ON FAILURE OFF FILE CREATION (infinite loop)
  async sync() {
    console.log(`Started sync. of meta-files @ ${moment().toISOString()} ...`);
    const {finished, missing} = await super.sync();

    const latest_meta_content = await this.service.generate();
    const latest_meta_content_hash = Base64.stringify(sha256(latest_meta_content));

    if (finished.length) {
      const previous_meta_file = this.META_FILE;
      const previous_meta_file_hash = FilePOJO.generateContentHash(previous_meta_file);

      if (latest_meta_content_hash === previous_meta_file_hash) {
        console.log(`Sync. of meta-files succeeded @${moment().toISOString()}.`);
        return previous_meta_file;
      }
    }

    fs.writeFileSync(`${META_DATA_ROOT}${uuidv4()}-meta.ttl`, latest_meta_content);
    return await this.sync();
  }

  get META_FILE() {
    return this.getLatestFor('-meta.ttl');
  }
}