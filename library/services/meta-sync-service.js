import { FileSyncService } from './file-sync-service';
import { APP_URI, DEBUG_LOGS, META_DATA_ROOT } from '../../env';
import moment from 'moment';
import { FilePOJO } from '../entities/file-pojo';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { MetaGenService } from './meta-gen-service';

const PUBLISHER = `${APP_URI}/meta-sync-service`;

export class MetaSyncService extends FileSyncService {

  constructor(configSyncService) {
    super(PUBLISHER, META_DATA_ROOT);
    this.meta = new MetaGenService(configSyncService);
    this.debug = DEBUG_LOGS;
  }

  async init() {
    await this.sync();
    return this;
  }

  async sync() {
    try {
      const start = moment();
      console.log(`Started sync. of meta-files @ ${moment().toISOString()} ...`);
      const {finished} = await super.sync();

      const latest_meta_content = await this.meta.generate();
      const latest_meta_content_hash = FilePOJO.generateContentHash(latest_meta_content);

      if (finished.length) {
        const previous_meta_file = this.META_FILE;
        const previous_meta_file_hash = FilePOJO.generateContentHash(previous_meta_file);

        if (latest_meta_content_hash === previous_meta_file_hash) {
          const end = moment();
          console.log(`Sync. of meta files succeeded @${end}. That took me only ${moment.duration(start.diff(end)).
              humanize()}!`);
          return previous_meta_file;
        }
      }
      const latest_meta_filename = `${META_DATA_ROOT}${uuidv4()}-meta.ttl`;
      if (this.debug) {
        console.log(`[NEW]  ${latest_meta_content}`);
      }
      fs.writeFileSync(latest_meta_filename, latest_meta_content);
      return await this.sync();
    } catch (e) {
      if (this.debug) {
        console.log(e);
      }
      throw `Something unexpected happened when trying to sync. the meta-files.\nReason: ${e.message}`;
    }
  }

  get META_FILE() {
    return this.getLatestFor('-meta.ttl');
  }
}