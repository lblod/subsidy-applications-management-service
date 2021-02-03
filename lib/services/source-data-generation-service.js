import { query } from '../util/database';
import { bindingToNT, Graph, parse, RDFNode, serialize, SPARQLToRDFLibQuery } from '../util/rdflib';
import { v4 as uuidv4 } from 'uuid';
import { DEBUG_LOGS } from '../../env';

const SOURCE_GRAPH_TEMPLATE = 'http://source-data-generation-service/';

/**
 * Service responsible for generating the source-data
 */
export class SourceDataGenerationService {

  constructor(config_files) {
    this.config_files = config_files;
  }

  async generate(uri, source_definition = this.config_files.config.content['resource']) {
    try {
      let source = '';
      const {resources, properties} = parseDefinition(source_definition);

      const buffer = [];
      buffer.push(source_definition.prefixes.join('\n'));
      buffer.push('SELECT ?s ?p ?o');
      buffer.push('WHERE {');
      buffer.push('\tVALUES ?s {');
      buffer.push(`\t\t<${uri}>`);
      buffer.push('\t}');
      buffer.push('\t?s ?p ?o .');
      buffer.push(`\tFILTER (?p IN ( ${properties.map((prop, index) => {
        if (properties.length === index + 1) {
          return `${prop} ))`;
        }
        return `${prop},`;
      }).join('\n')}`);
      buffer.push('}');
      const q = buffer.join('\n');

      const response = await query(q);
      const rows = response.results.bindings.map(b => bindingToNT(b['s'], b['p'], b['o']));
      if (rows) {
        const store = new Graph();
        const graph = `${SOURCE_GRAPH_TEMPLATE}${uuidv4()}`;
        parse(rows.join('\n'), store, {graph});
        for (const resource of resources) {
          const buffer = [];
          buffer.push(source_definition.prefixes.join('\n'));
          buffer.push(`SELECT ?o WHERE { <${uri}> ${resource['s-prefix']} ?o . }`);
          const result = store.querySync(SPARQLToRDFLibQuery(buffer.join('\n'), false, store));
          for (const node of result) {
            resource['prefixes'] = source_definition.prefixes;
            source += await this.generate(node['?o'].value, resource);
          }
        }
        return rows.join('\n') + source;
      }
      return '';
    } catch (e) {
      if (DEBUG_LOGS) {
        console.warn(e);
      }
      throw 'Generation off source-data failed unexpectedly.';
    }
  }

}

/* PRIVATE FUNCTIONS */

function parseDefinition(definition) {
  let resources = [];
  const properties = definition.properties.map(prop => {
    if (typeof prop === 'string' || prop instanceof String) {
      return prop;
    }
    prop['prefixes'] = definition.prefixes;
    resources.push(prop);
    return prop['s-prefix'];
  });
  return {
    resources,
    properties,
  };
}