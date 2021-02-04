
const SERVICE_NAME = process.env.SERVICE_NAME || 'subsidy-application-management-service';
const SERVICE_URI = `http://data.lblod.info/services/${SERVICE_NAME}`;
const SEMANTIC_FORM_TYPE = process.env.SEMANTIC_FORM_TYPE || 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';

const MUTATION_QUERY_CHUNK_SIZE = process.env.MUTATION_QUERY_CHUNK_SIZE || 50;

const VERSIONED_CONFIGURATION_ROOT = process.env.VERSIONED_CONFIGURATION_ROOT || '/config/versioned/';
const VERSIONED_CONFIGURATION_WATCHER = !!(process.env.VERSIONED_CONFIGURATION_WATCHER) || false;

const META_DATA_ROOT = process.env.META_DATA_ROOT || '/data/meta/';
const META_DATA_CRON = process.env.META_DATA_CRON || undefined;

const DEBUG_LOGS = !!(process.env.DEBUG_LOGS) || false;

export {
  SERVICE_NAME,
  SERVICE_URI,
  SEMANTIC_FORM_TYPE,
  MUTATION_QUERY_CHUNK_SIZE,
  VERSIONED_CONFIGURATION_ROOT,
  VERSIONED_CONFIGURATION_WATCHER,
  META_DATA_ROOT,
  META_DATA_CRON,
  DEBUG_LOGS
};