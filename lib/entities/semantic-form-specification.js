export const SPEC_FILE_MATCHER = 'form.ttl';
export const CONFIG_FILE_MATCHER = 'form.json';

export class SemanticFormSpecification {

  constructor(sources) {

    this.sources = sources;

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

  get content() {
    return this.turtle.content;
  }

  get turtle() {
    return this.sources.find(file => file.filename.includes(SPEC_FILE_MATCHER));
  }

  get json() {
    return this.sources.find(file => file.filename.includes(CONFIG_FILE_MATCHER));
  }

  get schemes() {
    return this.json.content.meta['schemes'];
  }

  get definition() {
    return enrichUserDefinition(this.json.content['source']);
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