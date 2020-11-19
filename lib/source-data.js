import { query, update } from 'mu';
import { Graph, parse, RDFNode, bindingToNT, serialize } from './util/rdflib';

export const GRAPHS = {
  source: 'http://lblod.data.gift/services/subsidy-applications-management-service/source-graph',
  additions: "http://lblod.data.gift/services/subsidy-applications-management-service/additions-graph",
  removals: "http://lblod.data.gift/services/subsidy-applications-management-service/removals-graph",
}

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
 * TODO
 *  take a closer look at an issue we encountered in "search-query-management-service"
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