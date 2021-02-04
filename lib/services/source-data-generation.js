import { bindingsToNT, query } from '../util/database';
import { DEBUG_LOGS } from '../../env';

/**
 * Service responsible for generating the source-data
 */
export class SourceDataGeneration {

  constructor(config_files) {
    this.config_files = config_files;
  }

  async generate(uri, definition = this.config_files.config.content['resource']) {
    try {
      let resource = parse(definition);
      const response = await query(generateQuery(uri, resource));
      const rows = bindingsToNT(response.results.bindings);
      if (rows) {
        /**
         * NOTE: returns an object with content to mock the behavior off a file.
         */
        return { content: rows.join('\n') };
      }
    } catch (e){
      if (DEBUG_LOGS) {
        console.warn(e);
      }
      throw 'Generation off source-data failed unexpectedly.';
    }
  }

}

/* PRIVATE FUNCTIONS*/

function parse(def, path = '') {
  let resources = [];
  const properties = def.properties.map(prop => {
    if (typeof prop === 'string' || prop instanceof String) {
      return prop;
    }
    const buffer = [];
    if (path.length)
      buffer.push(path);
    buffer.push(prop['s-prefix']);

    const node = parse(prop, buffer.join('/'));
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

function generateQuery(uri, {prefixes, resources, properties}) {
  return `${prefixes.join('\n')}
SELECT * WHERE
{
{
SELECT ?s ?p ?o 
WHERE {
VALUES ?s {
<${uri}>
}
VALUES ?p {
${properties.join('\n')}
}
?s ?p ?o .
}
}
${resources.map(resource => generateResourceQuery(uri, resource)).join('')}
}`;
}

function generateResourceQuery(uri, {path, resources, properties}) {
  return `UNION
{
SELECT ?s ?p ?o WHERE
{ 
{
SELECT ?s ?p ?o 
WHERE {
VALUES ?p {
${properties.join('\n')}
}
<${uri}> ${path} ?s .
?s ?p ?o .
}
}
${resources.map(resource => generateResourceQuery(uri, resource)).join('')}
}
}`;
}