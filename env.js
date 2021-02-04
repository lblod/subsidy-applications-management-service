
const SERVICE_NAME = process.env.SERVICE_NAME || 'subsidy-application-management-service';
const APP_URI = `http://data.lblod.info/services/${SERVICE_NAME}`;

const SEMANTIC_FORM_TYPE = process.env.SEMANTIC_FORM_TYPE || 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';
const DATA_QUERY_CHUNK_SIZE = process.env.DATA_QUERY_CHUNK_SIZE || 50;

const VERSIONED_CONFIGURATION_ROOT = process.env.VERSIONED_CONFIGURATION_ROOT || '/config/versioned/';
const VERSIONED_CONFIGURATION_WATCHER = !!(process.env.VERSIONED_CONFIGURATION_WATCHER) || false;

const META_DATA_ROOT = process.env.META_DATA_ROOT || '/data/meta/';

const DEBUG_LOGS = !!(process.env.DEBUG_LOGS) || false;



export {
  SEMANTIC_FORM_TYPE,
  APP_URI,
  DATA_QUERY_CHUNK_SIZE,
  META_DATA_ROOT,
  VERSIONED_CONFIGURATION_ROOT,
  VERSIONED_CONFIGURATION_WATCHER,
  DEBUG_LOGS
};