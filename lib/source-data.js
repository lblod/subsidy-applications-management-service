import { query, update } from 'mu';
import { querySudo } from '@lblod/mu-auth-sudo';
import { Graph, parse, RDFNode, bindingToNT, serialize } from './util/rdflib';
import { DATA_QUERY_CHUNK_SIZE } from '../env';

/**
 * JS file containing all generic logic linked to the source-data
 */

const GRAPHS = {
  additions: 'http://additions-graph',
  removals: 'http://removals-graph',
};

/**
 * Will try to retrieve the source-data for the given options.
 */
export async function getSourceData({resource, graph, sudo = false} = {}, store = new Graph()) {
  const retrieve = sudo ? (...params) => querySudo(...params) : (...params) => query(...params);
  for (const prop of resource.properties) {
    let bindings = [];
    if (typeof prop === 'string' || prop instanceof String) {
      bindings = await getPropertyBindings(resource, prop, retrieve);
    } else {
      bindings = await getPropertyBindings(resource, prop['s-prefix'], retrieve);
      if (bindings.length) {
        for (let binding of bindings) {
          store = await getSourceData({
            resource: {
              prefixes: resource.prefixes,
              node: binding['o'],
              properties: prop.properties,
            }, graph, sudo,
          }, store);
        }
      }
    }
    if (bindings.length) {
      const ttl = bindings.map(b => bindingToNT(resource.node, b['p'], b['o'])).join('\n');
      parse(ttl.trim(), store, {graph});
    }
  }
  return store;
}

async function getPropertyBindings(resource, path, retrieve) {
  const result = await retrieve(`
${resource.prefixes.join('\n')}

SELECT ?p ?o
WHERE {
  <${resource.node.value}> ${path} ?o ;
  ?p ?o .
}`);
  if (result.results.bindings.length) {
    return result.results.bindings;
  }
  return [];
}

/**
 * Will update the source-data for the given delta {additions, removals}.
 *
 * TODO take a closer look at an issue we encountered in "search-query-management-service" (this runs an updated rdflib version)
 *  > So n-triples characters may be escaped for special ones. E.g. \u0027
 *  > SPARQL expects 'decoded/unescaped' data. It won't interpret  \u0027. So we have to do the conversion ourselves
 */
export async function updateSourceData({additions = '', removals = ''} = {}) {
  const store = new Graph();
  parse(additions, store, {graph: GRAPHS.additions});
  parse(removals, store, {graph: GRAPHS.removals});
  await removeSourceData(store, {graph: GRAPHS.removals});
  await addSourceData(store, {graph: GRAPHS.additions});
}

/**
 * Will remove the source-data contained within a graph in the given rdflib store.
 */
export async function removeSourceData(store, options) {
  const removals = store.match(undefined, undefined, undefined, RDFNode(options.graph));
  console.log(`removals found: ${removals.length}`);
  if (removals.length > 0) {
    for (const chunk of chunkStatements(removals)) {
      await update(`
DELETE DATA {
  GRAPH <http://mu.semte.ch/application> {
${chunk.map(statement => statement.toNT()).join('\n')}
  }
}`);
    }
  }
}

/**
 * Will insert the source-data contained within a graph in the given rdflib store.
 */
async function addSourceData(store, options) {
  const additions = store.match(undefined, undefined, undefined, RDFNode(options.graph));
  console.log(`additions found: ${additions.length}`);
  if (additions.length > 0) {
    for (const chunk of chunkStatements(additions)) {
      await update(`
INSERT DATA {
  GRAPH <http://mu.semte.ch/application> {
${chunk.map(statement => statement.toNT()).join('\n')}
  }
}`);
    }
  }
}

function chunkStatements(statements, chunk = DATA_QUERY_CHUNK_SIZE) {
  let chunks = [];
  for (let i = 0; i < statements.length; i += chunk) {
    chunks.push(statements.slice(i, i + chunk));
  }
  return chunks;
}