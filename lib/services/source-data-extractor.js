import { bindingsToNT, query } from '../util/database';

/**
 * Service providing extraction of source-data from the store.
 */
export class SourceDataExtractor {

  constructor({sudo = false} = {}) {
    this.sudo = sudo;
  }

  /**
   * Extract source-data for the given URI and definition.
   *
   * @param uri - the root of which we want to extract source-data from.
   * @param definition - pre-defined syntax to define what data we want to extract [TODO document syntax in Readme]
   *
   * @returns {Promise<{string}>} - The n-triples that have been extracted.
   */
  async extract(uri, definition, nested=true) {
    try {
      const response = await query(generateQuery(uri, definition, nested));
      const rows = bindingsToNT(response.results.bindings);
      if (rows) {
        /**
         * NOTE: returns an object with content to mock the behavior of a file.
         */
        return rows.join('\n');
      }
    } catch (e) {
      console.error(e);
      throw 'Extraction of source-data has failed unexpectedly.';
    }
  }

}

/* PRIVATE FUNCTIONS*/

/**
 * Generates source-data extraction query based on the given param.
 *
 * TODO:  Find a way to render this more human friendly in the logs ...
 * TODO:  Redo with proper escape for URI
 *
 * @param uri - the root of which we want to extract source-data from.
 * @param prefixes - to be used in the query.
 * @param resources - nested resources.
 * @param properties - of the root.
 *
 * @returns {string}
 */
function generateQuery(uri, {prefixes, resources, properties}, nested=true) {
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
    ${nested ? resources.map(resource => generateNestedResourceSubQuery(uri, resource)).join('') : ''}
}`;
}

/**
 * Generates sub-query for a nested-resource.
 *
 * TODO:  Find a way to render this more human friendly in the logs ...
 * TODO:  Redo with proper escape for URI
 *
 * @param uri - the root of which we want to extract source-data from.
 * @param path - path from root to the nested-resource.
 * @param resources - nested of the current nested-resource
 * @param properties - of the nested-resource
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