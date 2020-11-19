import { query, update } from 'mu';
import { Graph, parse, RDFNode, bindingToNT, serialize } from './util/rdflib';

/**
 * JS file containing all generic logic linked to the source-data
 */

export const GRAPHS = {
  source: 'http://lblod.data.gift/services/subsidy-applications-management-service/source-graph',
  additions: "http://lblod.data.gift/services/subsidy-applications-management-service/additions-graph",
  removals: "http://lblod.data.gift/services/subsidy-applications-management-service/removals-graph",
}

/**
 * Will try to retrieve the source-data for the given options.
 */
export async function getSourceData({prefixes, where, paths}) {
  const store = new Graph();
  for(const path of paths) {
    const result = await query(`
${prefixes.join('\n')}

SELECT ?s ?p ?o
WHERE {
  GRAPH ?g {
    ${where}
    ?s ${path} ?o .
    ?s ?p ?o .
  }
}`);
    if (result.results.bindings.length) {
      const bindings = result.results.bindings;
      const ttl = bindings.map(b => bindingToNT(b['s'], b['p'], b['o'])).join('\n').trim();
      parse(ttl, store, {graph: GRAPHS.source});
    }
  }
  return store;
}

/**
 * Will update the source-data for the given delta {additions, removals}.
 *
 * TODO take a closer look at an issue we encountered in "search-query-management-service" (this runs an updated rdflib version)
 *  > So n-triples characters may be escaped for special ones. E.g. \u0027
 *  > SPARQL expects 'decoded/unescaped' data. It won't interpret  \u0027. So we have to do the conversion ourselves
 */
export async function updateSourceData({additions, removals}) {
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
  if(removals.length > 0) {
    await update(`
DELETE DATA {
  GRAPH <http://mu.semte.ch/application> {
    ${serialize(store, options)}
  }
}`);
  }
}

/**
 * Will insert the source-data contained within a graph in the given rdflib store.
 */
async function addSourceData(store, options) {
  const additions = store.match(undefined, undefined, undefined, RDFNode(options.graph));
  console.log(`additions found: ${additions.length}`);
  if(additions.length > 0) {
    await update(`
INSERT DATA {
  GRAPH <http://mu.semte.ch/application> {
    ${serialize(store, options)}
  }
}`);
  }
}