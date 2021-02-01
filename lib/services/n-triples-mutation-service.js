import { v4 as uuidv4 } from 'uuid';
import { bindingToNT, Graph, parse, RDFNode } from '../util/rdflib';
import { DATA_QUERY_CHUNK_SIZE } from '../../env';
import { query, update } from '../util/database';

export const COMMON_GRAPHS = {
  application: 'http://mu.semte.ch/application',
  public: 'http://mu.semte.ch/graphs/public'
}

const MUTATE_GRAPH_TEMPLATE = 'http://mutate-graph/';

/**
 * Service providing mutations on the store using the n-triple format.
 */
export class NTriplesMutationService {

  constructor({sudo = false} = {}) {
    this.sudo = sudo;
  }

  /**
   * Generates n-triples based on a given resource configuration.
   *  - TODO make more solid
   *  - TODO optimize (CONSTRUCTOR QUERIES)
   *
   * @param resource TODO document format
   * @param ttl
   * @returns {Promise<string>}
   */
  async generate(resource, ttl = '') {
    for (const prop of resource.properties) {
      let bindings = [];
      if (typeof prop === 'string' || prop instanceof String) {
        bindings = await getPropertyBindings(resource, prop, this.sudo);
      } else {
        bindings = await getPropertyBindings(resource, prop['s-prefix'], this.sudo);
        if (bindings.length) {
          for (let binding of bindings) {
            ttl = await this.generate(
                {
                  prefixes: resource.prefixes,
                  node: binding['o'],
                  properties: prop.properties,
                }, ttl);
          }
        }
      }
      if (bindings.length) {
        ttl += bindings.map(b => bindingToNT(resource.node, b['p'], b['o'])).join('\n');
      }
    }
    return ttl;
  }

  /**
   * Provide mutation off n-triples to the store.
   * - TODO make more solid
   *
   * @param mutation_type INSERT | DELETE
   * @param source_graph
   * @param statements
   * @returns {Promise<void>}
   */
  async mutate(mutation_type, source_graph, statements) {
    const store = new Graph();
    const graph = `${MUTATE_GRAPH_TEMPLATE}${uuidv4()}`;
    parse(statements, store, {graph});
    const parsed_statements = store.match(undefined, undefined, undefined, RDFNode(graph));
    if (parsed_statements.length > 0) {
      for (const chunk of chunkStatements(parsed_statements)) {
        await update(`
${mutation_type} DATA {
  GRAPH <${source_graph}> {
${chunk.map(statement => statement.toNT()).join('\n')}
  }
}`, this.sudo);
      }
    }
  }

  /**
   * Wrapper function to provide DELETE mutation of n-triples in the store.
   *
   * @param source_graph
   * @param removals
   * @returns {Promise<void>}
   */
  async delete(source_graph = COMMON_GRAPHS.application, removals = '') {
    await this.mutate('DELETE', source_graph, removals);
  }

  /**
   * Wrapper function to provide INSERT mutation of n-triples in the store.
   *
   * @param source_graph
   * @param additions
   * @returns {Promise<void>}
   */
  async insert(source_graph = COMMON_GRAPHS.application, additions = '') {
    await this.mutate('INSERT', source_graph, additions);
  }

  /**
   * Wrapper function to provide update (DELETE -> INSERT) mutation of n-triples in the store.
   *
   * @param source_graph
   * @param additions
   * @param removals
   * @returns {Promise<void>}
   */
  async update(source_graph = COMMON_GRAPHS.application, {additions = '', removals = ''} = {}) {
    await this.delete(source_graph, removals);
    await this.insert(source_graph, additions);
  }
}

/* PRIVATE FUNCTIONS */

/**
 * Resolves a single property-binding
 * - TODO make more solid
 *
 * @param resource
 * @param path
 * @param sudo
 * @returns {Promise<*[]|*>}
 */
async function getPropertyBindings(resource, path, sudo) {
  const result = await query(`
${resource.prefixes.join('\n')}

SELECT ?p ?o
WHERE {
  <${resource.node.value}> ${path} ?o ;
  ?p ?o .
}`, sudo);
  if (result.results.bindings.length) {
    return result.results.bindings;
  }
  return [];
}

/**
 * Chunks a given set off rdflib-statements into pre-defined size off chunk sizes
 * {@see DATA_QUERY_CHUNK_SIZE}
 *
 * @param statements
 * @param chunk
 * @returns {[]}
 */
function chunkStatements(statements, chunk = DATA_QUERY_CHUNK_SIZE) {
  let chunks = [];
  for (let i = 0; i < statements.length; i += chunk) {
    chunks.push(statements.slice(i, i + chunk));
  }
  return chunks;
}