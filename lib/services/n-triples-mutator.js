import { v4 as uuidv4 } from 'uuid';
import { Graph, parse, RDFNode } from '../util/rdflib';
import { QUERY_CHUNK_SIZE } from '../../env';
import { update } from '../util/database';

export const COMMON_GRAPHS = {
  application: 'http://mu.semte.ch/application',
  public: 'http://mu.semte.ch/graphs/public',
};

const MUTATE_GRAPH_TEMPLATE = 'http://mutate-graph/';

/**
 * Service providing mutations on the store using the n-triple format.
 */
export class NTriplesMutator {

  constructor({sudo = false} = {}) {
    this.sudo = sudo;
  }

  /**
   * Provide mutation of n-triples to the store.
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
  async delete(removals = '', source_graph = COMMON_GRAPHS.application) {
    await this.mutate('DELETE', source_graph, removals);
  }

  /**
   * Wrapper function to provide INSERT mutation of n-triples in the store.
   *
   * @param source_graph
   * @param additions
   * @returns {Promise<void>}
   */
  async insert(additions = '', source_graph = COMMON_GRAPHS.application) {
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
  async update({additions = '', removals = ''} = {}, source_graph = COMMON_GRAPHS.application) {
    await this.delete(removals, source_graph);
    await this.insert(additions, source_graph);
  }
}

/* PRIVATE FUNCTIONS */

/**
 * Chunks a given set of rdflib-statements into pre-defined size of chunk sizes
 * {@see QUERY_CHUNK_SIZE}
 *
 * @param statements
 * @param chunk
 * @returns {[]}
 */
function chunkStatements(statements, chunk = QUERY_CHUNK_SIZE) {
  let chunks = [];
  for (let i = 0; i < statements.length; i += chunk) {
    chunks.push(statements.slice(i, i + chunk));
  }
  return chunks;
}