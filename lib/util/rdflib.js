import { sparqlEscapeUri, sparqlEscapeString } from 'mu';

import { graph as Graph, parse as rdflibParse, serialize as rdflibSerialize, sym as RDFNode, Namespace, SPARQLToQuery as SPARQLToRDFLibQuery} from 'rdflib';

/**
 * JS file containing all helpers for working with RDFlib
 */

// name-spaces used to query with rdflib.
export const MU = Namespace('http://mu.semte.ch/vocabularies/core/');
export const RDF = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
export const DCT = Namespace('http://purl.org/dc/terms/');
export const ADMS = Namespace('http://www.w3.org/ns/adms#');
export const FORM = Namespace('http://lblod.data.gift/vocabularies/forms/');


function serialize(store, {graph, contentType = 'application/n-triples'} = {}) {
  return rdflibSerialize(RDFNode(graph), store, undefined, contentType);
}

function parse(ttl, store, {graph, contentType = 'text/turtle'} = {}) {
  rdflibParse(ttl, store, graph, contentType);
}

// TODO: move, in the wrong helper file
function bindingToNT(s, p, o) {
  const subject = sparqlEscapeUri(s.value);
  const predicate = sparqlEscapeUri(p.value);
  let obj;
  if (o.type === 'uri') {
    obj = sparqlEscapeUri(o.value);
  } else {
    obj = `${sparqlEscapeString(o.value)}`;
    if (o.datatype)
      obj += `^^${sparqlEscapeUri(o.datatype)}`;
  }
  return `${subject} ${predicate} ${obj} .`;
}

export {
  serialize,
  parse,
  bindingToNT,
  Graph,
  RDFNode,
  SPARQLToRDFLibQuery
}