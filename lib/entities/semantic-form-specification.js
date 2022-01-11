import {FORM, Graph, parse, RDFNode} from '../util/rdflib';
import uniq from 'lodash.uniq';

export const SPEC_FILE_MATCHER = 'form.ttl';
export const CONFIG_FILE_MATCHER = 'form.json';

const GRAPH = 'http://form-spec/1701';

export class SemanticFormSpecification {

  constructor(sources) {
    this.sources = sources;

    this._store = new Graph();
    this.parsed = false;
  }

  get store() {
    if (!this.parsed) {
      /* Initialize store with spec. TTL */
      try {
        parse(this.turtle.content, this._store, {graph: GRAPH});
      } catch (e) {
        // NOTE: if it fails, it fails.
      }
    }
    return this._store
  }

  get content() {
    return this.turtle.content;
  }

  get turtle() {
    return this.sources.find(file => file.filename.includes(SPEC_FILE_MATCHER));
  }

  get json() {
    return this.sources.find(
        file => file.filename.includes(CONFIG_FILE_MATCHER));
  }

  get schemes() {
    /* schemes in spec */
    let schemes = this.store.match(undefined, FORM('options'), undefined,
        new RDFNode(GRAPH)).
        map(op => JSON.parse(op.object.value)).
        filter(op => !!op.conceptScheme).
        map(op => op.conceptScheme);
    /* enhanced with json config */
    if (this.json.content.meta && this.json.content.meta['schemes'] &&
        this.json.content.meta['schemes'].length > 0)
      schemes = schemes.concat(this.json.content.meta['schemes']);
    return uniq(schemes);
  }

  get definition() {
    return enrichUserDefinition(this.json.content['source']);
  }

  validate() {
    const buffer = [];
    buffer.push('[ERROR] Missing form-specification files:');
    if (!this.turtle) {
      buffer.push(`\t\t- ${SPEC_FILE_MATCHER}`);
    }
    if (!this.json) {
      buffer.push(`\t\t- ${CONFIG_FILE_MATCHER}`);
    }
    if (buffer.length > 1) {
      throw buffer.join('\n');
    }
  }

  toJSON() {
    return {
      turtle: this.turtle,
      json: this.json,
    };
  }
}

/* PRIVATE FUNCTIONS */

/**
 * Parse the pre-defined user definition into what we need to construct the query.
 *
 * @param def - pre-defined user definition .
 * @param path - path from root to nested resource .
 *
 * @returns {{path: string, prefixes: string[], resources: [], properties: (string|*)[]}}
 */
function enrichUserDefinition(def, path = '') {
  let resources = [];
  const properties = def.properties.map(prop => {
    if (typeof prop === 'string' || prop instanceof String) {
      return prop;
    }
    const buffer = [];
    if (path.length)
      buffer.push(path);
    buffer.push(prop['s-prefix']);

    const node = enrichUserDefinition(prop, buffer.join('/'));
    resources.push(node);
    return prop['s-prefix'];
  });
  return {
    prefixes: def.prefixes,
    path,
    resources,
    properties,
  };
}