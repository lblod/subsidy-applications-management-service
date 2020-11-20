const ACTIVE_FORM = process.env.ACTIVE_FORM || 'form.ttl';
const META_DATA = process.env.META_DATA || 'meta.ttl';

const ACTIVE_FORM_URI = `share://${ACTIVE_FORM}`;
const META_DATA_URI = `share://${META_DATA}`;

const CONFIG = require('/share/config.json') || {
  'application-form': {
    prefixes: [
      'PREFIX mu: <http://mu.semte.ch/vocabularies/core/>',
      'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>',
    ],
    paths: [
      'rdf:type',
      'mu:uuid',
    ],
  },
};

export {
  ACTIVE_FORM,
  ACTIVE_FORM_URI,
  META_DATA_URI,
  CONFIG,
};