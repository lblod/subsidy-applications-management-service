import { bindingsToNT, query } from '../util/database';
import { Graph, parse, serialize } from '../util/rdflib';
import { v4 as uuidv4 } from 'uuid';
import { META_DATA_EXTRACTION_BLACK_LIST } from '../../env';

const META_GRAPH_TEMPLATE = 'http://meta-data-extractor/';

/**
 * Service providing extraction of meta-data from the store.
 */
export class MetaDataExtractor {

  /**
   * Extract meta-data for the given schemes
   *
   * TODO:  - add some post-processing on the meta-data to enforce business logic.
   *
   * @returns {Promise<string>} - NTriple representation of the meta-data
   */
  async extract(schemes) {
    try {
      // NOTE: experiment on how to create better formatted queries in the logs (but lost readability in code)
      const buffer = [];
      buffer.push('PREFIX skos: <http://www.w3.org/2004/02/skos/core#>');
      buffer.push('SELECT DISTINCT ?s ?p ?o');
      buffer.push('WHERE {');
      buffer.push('\tVALUES ?scheme {');
      buffer.push(schemes.map(scheme => `\t<${scheme}>`).join('\n'));
      buffer.push('\t}');
      buffer.push('\t?s skos:inScheme ?scheme .');
      buffer.push('\t?s ?p ?o .');
      if (META_DATA_EXTRACTION_BLACK_LIST && META_DATA_EXTRACTION_BLACK_LIST.length > 0)
        buffer.push(`\tFILTER (?s NOT IN (${META_DATA_EXTRACTION_BLACK_LIST.map(s => `<${s}>`).join(', ')}))`);
      buffer.push('\tFILTER (?p IN (skos:prefLabel, skos:inScheme))');
      buffer.push('}');
      const q = buffer.join('\n');

      const response = await query(q);
      const rows = bindingsToNT(response.results.bindings);
      if (rows) {
        /**
         * NOTE:  How virtuoso returns the data  is "inconsistent".
         *        This makes it difficult, near impossible to determine if changes actually occurred.
         *        To get this consistency, we parse it through rdflib.
         */
        const store = new Graph();
        const graph = `${META_GRAPH_TEMPLATE}${uuidv4()}`;
        parse(rows.join('\n'), store, {graph});
        return serialize(store, {graph});
      }
      return '';
    } catch (e) {
      console.error(e);
      throw 'Extraction of meta-data failed unexpectedly.';
    }
  }
}