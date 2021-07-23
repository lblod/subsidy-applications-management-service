import {
  graph as Graph,
  parse as rdflibParse,
  serialize as rdflibSerialize,
  sym as RDFNode,
  Namespace,
  SPARQLToQuery as SPARQLToRDFLibQuery,
} from 'rdflib';

/**
 * JS file containing all helpers for working with RDFlib
 */

// NOTE: name-spaces used to query with rdflib.
export const RDF = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
export const FORM = Namespace('http://lblod.data.gift/vocabularies/forms/');

function serialize(store, {graph, contentType = 'application/n-triples'} = {}) {
  return rdflibSerialize(RDFNode(graph), store, undefined, contentType);
}

function parse(ttl, store, {graph, contentType = 'text/turtle'} = {}) {
  rdflibParse(ttl, store, graph, contentType);
}

export {
  serialize,
  parse,
  Graph,
  RDFNode,
  SPARQLToRDFLibQuery,
};