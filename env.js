
const META_DATA = process.env.META_DATA || 'meta.ttl';
const FORM_DATA_DIR = process.env.FORM_DATA_DIR || '/share/form-versions/';
const SERVICE_NAME = process.env.SERVICE_NAME || 'subsidy-application-management-service';

const META_DATA_URI = `share://${META_DATA}`;
const APP_URI = `http://data.lblod.info/services/${SERVICE_NAME}`;

const DEFAULT_CONFIG = {
  'application-form': {
    prefixes: [
      'PREFIX mu: <http://mu.semte.ch/vocabularies/core/>',
      'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>',
    ],
    properties: [
      'rdf:type',
      'mu:uuid',
    ],
  },
};

const USER_CONFIG = require('/share/config.json') || DEFAULT_CONFIG;

export {
  META_DATA_URI,
  DEFAULT_CONFIG,
  USER_CONFIG,
  FORM_DATA_DIR,
  APP_URI,
};