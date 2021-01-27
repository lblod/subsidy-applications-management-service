import { v4 as uuidv4 } from 'uuid';
import { bindingToNT, Graph, parse, RDFNode } from '../util/rdflib';
import { DATA_QUERY_CHUNK_SIZE } from '../../env';
import { query, update } from '../util/database';

const MUTATE_GRAPH_TEMPLATE = 'http://mutate-graph/';

export class NTriplesMutationService {

  constructor({sudo = false} = {}) {
    this.store = new Graph();
    this.sudo = sudo;
  }

  async get(resource, ttl = '') {
    for (const prop of resource.properties) {
      let bindings = [];
      if (typeof prop === 'string' || prop instanceof String) {
        bindings = await getPropertyBindings(resource, prop, this.sudo);
      } else {
        bindings = await getPropertyBindings(resource, prop['s-prefix'], this.sudo);
        if (bindings.length) {
          for (let binding of bindings) {
            ttl = await this.get(
                {
                  prefixes: resource.prefixes,
                  node: binding['o'],
                  properties: prop.properties,
                }, ttl);
          }
        }
      }
      if (bindings.length) {
        ttl += bindings.map(b => bindingToNT(resource.node, b['p'], b['o'])).join('\n') + '\n\n';
      }
    }
    return ttl;
  }

  // TODO make more solid
  async mutate(mutation_type, source_graph, statements) {
    const graph = `${MUTATE_GRAPH_TEMPLATE}${uuidv4()}`;
    parse(statements, this.store, {graph});
    const parsed_statements = this.store.match(undefined, undefined, undefined, RDFNode(graph));
    if (parsed_statements.length > 0) {
      for (const chunk of chunkStatements(parsed_statements)) {
        await update(`
${mutation_type} DATA {
  GRAPH <${source_graph}> {
${chunk.map(statement => statement.toNT()).join('\n')}
  }
}`, this.sudo);
      }
      // TODO check if this actually worked
      this.store.removeStatements(parsed_statements); // NOTE: clean up the store
    }
  }

  async remove(source_graph = 'http://mu.semte.ch/application', removals = '') {
    await this.mutate('DELETE', source_graph, removals);
  }

  async add(source_graph = 'http://mu.semte.ch/application', additions = '') {
    await this.mutate('INSERT', source_graph, additions);
  }

  async update(source_graph = 'http://mu.semte.ch/application', {additions = '', removals = ''} = {}) {
    await this.remove(source_graph, removals);
    await this.add(source_graph, additions);
  }
}

/* PRIVATE FUNCTIONS */

// TODO make more solid
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

function chunkStatements(statements, chunk = DATA_QUERY_CHUNK_SIZE) {
  let chunks = [];
  for (let i = 0; i < statements.length; i += chunk) {
    chunks.push(statements.slice(i, i + chunk));
  }
  return chunks;
}