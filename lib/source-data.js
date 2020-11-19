import { update } from 'mu';
import { graph as Graph, sym as rdfNode } from 'rdflib';
import { parse, serialize } from './util/db-to-rdflib';

const GRAPHS = {
  additions: "http://temp-additions-graph",
  removals: "http://temp-removals-graph"
}

/**
 * TODO make this less prone for errors by batching the additions and removals.
 *  also might take a closer look at an issue we encounterd in "search-query-management-service"
 *  > So n-triples charcacters may be escaped for special ones. E.g. \u0027
 *  > SPARQL expects 'decoded/unescaped' data. It won't interpret  \u0027. So we have to do the conversion ourselves
 */

export async function updateSourceData({additions, removals}) {
  const store = new Graph();
  parse(additions, store, {graph: GRAPHS.additions});
  parse(removals, store, {graph: GRAPHS.removals});
  await removeSourceData(store);
  await addSourceData(store);
}

async function removeSourceData(store) {
  const removals = store.match(undefined, undefined, undefined, rdfNode(GRAPHS.removals));
  console.log(`removals found: ${removals.length}`);
  if(removals.length > 0) {
    await update(`
DELETE DATA {
  GRAPH <http://mu.semte.ch/application> {
    ${serialize(store, {graph: GRAPHS.removals})}
  }
}`);
  }
}

async function addSourceData(store) {
  const additions = store.match(undefined, undefined, undefined, rdfNode(GRAPHS.additions));
  console.log(`additions found: ${additions.length}`);
  if(additions.length > 0) {
    await update(`
INSERT DATA {
  GRAPH <http://mu.semte.ch/application> {
    ${serialize(store, {graph: GRAPHS.additions})}
  }
}`);
  }
}