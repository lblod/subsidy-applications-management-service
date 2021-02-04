import { bindingsToNT, query } from '../util/database';

/**
 * Service providing extraction off source-data from the store.
 */
export class SourceDataExtractor {

  /**
   * Extract source-data for the given URI and definition.
   *
   * @param uri - the root of which we want to extract source-data from.
   * @param definition - pre-defined syntax to define what data we want to extract [TODO document syntax in Readme]
   *
   * @returns {Promise<{content: string}>} - MockFile with as it's contents the n-triples that have been extracted.
   */
  async extract(uri, definition) {
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
      console.error(e);
      throw 'Extraction off source-data has failed unexpectedly.';
    }
  }

}

/* PRIVATE FUNCTIONS*/

/**
 * Parse the pre-defined user definition into what we need to construct the query.
 *
 * @param def - pre-defined user definition .
 * @param path - path from root to nested resource .
 *
 * @returns {{path: string, prefixes: string[], resources: [], properties: (string|*)[]}}
 */
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

/**
 * Generates source-data extraction query based on the given param.
 *
 * TODO:  Find a way to render this more human friendly in the logs ...
 *
 * @param uri - the root of which we want to extract source-data from.
 * @param prefixes - to be used in the query.
 * @param resources - nested resources.
 * @param properties - off the root.
 *
 * @returns {string}
 */
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
            ${properties.join('\n\t\t')}
            }
            ?s ?p ?o .
        }
    }
    ${resources.map(resource => generateNestedResourceSubQuery(uri, resource)).join('')}
}`;
}

/**
 * Generates sub-query for a nested-resource.
 *
 * TODO:  Find a way to render this more human friendly in the logs ...
 *
 * @param uri - the root of which we want to extract source-data from.
 * @param path - path from root to the nested-resource.
 * @param resources - nested off the current nested-resource
 * @param properties - off the nested-resource
 *
 * @returns {string}
 */
function generateNestedResourceSubQuery(uri, {path, resources, properties}) {
  return `UNION
{
    SELECT ?s ?p ?o WHERE { 
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
    ${resources.map(resource => generateNestedResourceSubQuery(uri, resource)).join('')}
    }
}`;
}