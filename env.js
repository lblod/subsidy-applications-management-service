/**
 * JS file containing all env. and derived variables.
 */

const SERVICE_NAME = process.env.SERVICE_NAME || 'subsidy-application-management-service';
const SERVICE_URI = `http://data.lblod.info/services/${SERVICE_NAME}`;

const SEMANTIC_FORM_TYPE = process.env.SEMANTIC_FORM_TYPE || 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';
const SEMANTIC_FORM_RESOURCE_BASE = process.env.SEMANTIC_FORM_RESOURCE_BASE || 'http://data.lblod.info/application-forms/';
const SEMANTIC_FORM_CONFIGURATION_ROOT = process.env.SEMANTIC_FORM_CONFIGURATION_ROOT || '/config/forms/';

const QUERY_CHUNK_SIZE = process.env.QUERY_CHUNK_SIZE || 50;

const META_DATA_ROOT = process.env.META_DATA_ROOT || '/data/meta-files/';
const META_DATA_CRON = process.env.META_DATA_CRON || '0 */15 8-18 * * 1-5';
const META_DATA_EXTRACTION_BACKOFF_INITIAL_WAIT = process.env['META_DATA_EXTRACTION_BACKOFF_INITIAL_WAIT'] || 5000;
const META_DATA_EXTRACTION_BACKOFF_RATE = process.env['META_DATA_EXTRACTION_BACKOFF_RATE'] || 0.3;
const META_DATA_EXTRACTION_BACKOFF_MAX_WAIT = process.env['META_DATA_EXTRACTION_BACKOFF_MAX_WAIT'] || 600000; // 10 min
const META_DATA_EXTRACTION_BLACK_LIST = process.env['META_DATA_EXTRACTION_BLACK_LIST'] && process.env['META_DATA_EXTRACTION_BLACK_LIST'].split(',');
// TODO find a better name
const META_DATA_STALE_CRON_STOP = process.env.META_DATA_STALE_CRON_STOP || 5

const TAILORED_META_DATA_ROOT = process.env.TAILORED_META_DATA_ROOT || '/data/tailored-meta-files/';

const DEBUG_LOGS = process.env.DEBUG_LOGS;
const DEV_ENV = process.env.NODE_ENV && (process.env.NODE_ENV === 'development');

export {
  SERVICE_NAME,
  SERVICE_URI,
  SEMANTIC_FORM_TYPE,
  SEMANTIC_FORM_RESOURCE_BASE,
  SEMANTIC_FORM_CONFIGURATION_ROOT,
  QUERY_CHUNK_SIZE,
  META_DATA_ROOT,
  META_DATA_CRON,
  META_DATA_EXTRACTION_BACKOFF_INITIAL_WAIT,
  META_DATA_EXTRACTION_BACKOFF_RATE,
  META_DATA_EXTRACTION_BACKOFF_MAX_WAIT,
  META_DATA_EXTRACTION_BLACK_LIST,
  META_DATA_STALE_CRON_STOP,
  TAILORED_META_DATA_ROOT,
  DEBUG_LOGS,
  DEV_ENV,
};