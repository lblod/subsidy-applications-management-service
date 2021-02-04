import { query } from '../util/database';
import { bindingToNT } from '../util/rdflib';
import { DEBUG_LOGS } from '../../env';

/**
 * Service responsible for generating the source-data
 */
export class SourceDataGenerationService {

  constructor(config_files) {
    this.uri = 'http://data.lblod.info/application-forms/601AB2F9D23ECD000B000002';
    this.config_files = config_files;
  }

  async generate(uri, source_definition = this.config_files.config.content['resource']) {
    try {
      let resource = parseDefinition(source_definition);
      const response = await query(generateQuery(uri, resource));
      const rows = response.results.bindings.map(b => bindingToNT(b['s'], b['p'], b['o']));
      if (rows) {
        return rows.join('\n');
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

function parseDefinition(def, path = '') {
  let resources = [];
  const properties = def.properties.map(prop => {
    if (typeof prop === 'string' || prop instanceof String) {
      return prop;
    }
    const buffer = [];
    if (path.length)
      buffer.push(path);
    buffer.push(prop['s-prefix']);

    const node = parseDefinition(prop, buffer.join('/'));
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