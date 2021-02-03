import { query } from '../util/database';
import { bindingToNT, Graph, parse, serialize } from '../util/rdflib';
import { v4 as uuidv4 } from 'uuid';
import { DEBUG_LOGS } from '../../env';

const META_GRAPH_TEMPLATE = 'http://meta-gen-service/';

/**
 * Service responsible for generating the meta-data
 */
export class MetaDataGenerationService {

  constructor(config_files) {
    this.config_files = config_files;
  }

  async generate() {
    const schemes = this.config_files.config.content.meta['concept-schemes'];
    try {
      const buffer = [];
      buffer.push('PREFIX skos: <http://www.w3.org/2004/02/skos/core#>');
      buffer.push('SELECT DISTINCT ?s ?p ?o');
      buffer.push('WHERE {');
      buffer.push('\tVALUES ?scheme {');
      buffer.push(schemes.map(scheme => `\t<${scheme}>`).join('\n'));
      buffer.push('\t}');
      buffer.push('\t?s skos:inScheme ?scheme .');
      buffer.push('\t?s ?p ?o .');
      buffer.push('\tFILTER (?p IN (skos:prefLabel, skos:inScheme))');
      buffer.push('}');
      const q = buffer.join('\n');

      const response = await query(q);
      const rows = response.results.bindings.map(b => bindingToNT(b['s'], b['p'], b['o']));
      if(rows) {
        /**
         * NOTE:  How virtuoso returns the data  is "inconsistent".
         *        This makes it difficult, near impossible to determine if changes actually occurred.
         *        To get this consistency, we parse it through rdflib.
         */
        const store = new Graph();
        const graph = `${META_GRAPH_TEMPLATE}${uuidv4()}`;
        parse(rows.join('\n'), store, {graph});
        return serialize(store, {graph}) ;
      }
      return '';
    } catch (e) {
      if(DEBUG_LOGS) {
        console.warn(e);
      }
      throw `Generation off meta-data failed unexpectedly.\nReason: ${e.message}`;
    }
  }
}