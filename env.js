const META_DATA = process.env.META_DATA || 'meta.ttl';
const FORM_DATA_DIR = process.env.FORM_DATA_DIR || '/share/form-files/';
const SERVICE_NAME = process.env.SERVICE_NAME || 'subsidy-application-management-service';
const DATA_QUERY_CHUNK_SIZE = process.env.DATA_QUERY_CHUNK_SIZE || 50;

const META_DATA_URI = `share://${META_DATA}`;
const APP_URI = `http://data.lblod.info/services/${SERVICE_NAME}`;

// TODO replace "application-form" with something more generic like "resource"
const DEFAULT_CONFIG = {
  'application-form': {
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
  META_DATA_URI,
  DEFAULT_CONFIG,
  FORM_DATA_DIR,
  APP_URI,
  DATA_QUERY_CHUNK_SIZE
};