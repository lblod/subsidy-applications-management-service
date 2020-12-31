const SERVICE_NAME = process.env.SERVICE_NAME || 'subsidy-application-management-service';
const DATA_QUERY_CHUNK_SIZE = process.env.DATA_QUERY_CHUNK_SIZE || 50;
const FORM_VERSION_DIRECTORY = process.env.FORM_DATA_DIR || '/share/versions/';
const SEMANTIC_FORM_TYPE = process.env.FORM_DATA_DIR || 'http://lblod.data.gift/vocabularies/subsidie/ApplicationForm';

const APP_URI = `http://data.lblod.info/services/${SERVICE_NAME}`;

const DEFAULT_CONFIG = {
  resource: {
    prefixes: [
      'PREFIX mu: <http://mu.semte.ch/vocabularies/core/>',
      'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>',
      'PREFIX dct: <http://purl.org/dc/terms/>',
      'PREFIX adms: <http://www.w3.org/ns/adms#>',
    ],
    properties: [
      'rdf:type',
      'mu:uuid',
      'dct:source',
      'adms:status',
    ],
  },
};

export {
  DEFAULT_CONFIG,
  FORM_VERSION_DIRECTORY,
  SEMANTIC_FORM_TYPE,
  APP_URI,
  DATA_QUERY_CHUNK_SIZE,
};