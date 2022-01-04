import { SemanticFile } from '../entities/semantic-file';
import { SemanticFormSources } from './semantic-form-sources';
import { DEBUG_LOGS } from '../../env';

const MAPPER_FILE_MATCHER = 'mapper.js';

/**
 * Service providing the user configuration
 */
export class Configuration {

  constructor() {
    this.sources = new SemanticFormSources();
  }

  /**
   * Initialize the configuration.
   */
  async init() {
    console.log(`Starting ingestion off user configuration`);
    try {
      await this.sources.init();
      /**
       * NOTE: mapper is not used anymore
       *
       * TODO: dead code.
       */
      this.mapper = getMappingStrategy();
    } catch (e) {
      if (DEBUG_LOGS) {
        console.log(e);
      }
      throw `[ERROR] Failed to ingest configuration: \"${e.message}\"`;
    }
    return this;
  }

}

/* PRIVATE FUNCTIONS */

/**
 * Tries to return the mapping strategy .js file.
 *
 * @type {SemanticFile}
 */
function getMappingStrategy() {
  const file = new SemanticFile({filename: `/config/${MAPPER_FILE_MATCHER}`});
  if (SemanticFile.exists(file)) {
    return file;
  }
  throw `Missing mapping strategy, make sure to configure your ${MAPPER_FILE_MATCHER}`;
}