import { sparqlEscapeUri, sparqlEscapeString } from 'mu';

import { querySudo as query } from '@lblod/mu-auth-sudo';
import { parse as rdflibParse, serialize as rdflibSerialize, sym, Namespace } from 'rdflib';

// !!TODO IMPROVE SECURITY
//  either by removing sudo or making a check

export const MU = Namespace('http://mu.semte.ch/vocabularies/core/');
export const RDF = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
export const DCT = Namespace('http://purl.org/dc/terms/');

// TODO make env. vars
const BATCH_SIZE = 1000;
const DEPTH = 3

// TODO improve
export const DEFAULT_GRAPH = 'http://lblod.data.gift/services/temp/';

export function serialize(store, {contentType = 'application/n-triples', graph = DEFAULT_GRAPH} = {}) {
  return rdflibSerialize(sym(graph), store, undefined, contentType);
}

export function parse(ttl, store, {contentType = 'text/turtle', graph = DEFAULT_GRAPH} = {}) {
  rdflibParse(ttl, store, graph, contentType);
}

export async function loadDBintoRDFLIBStore(store, {prefixes = [], where}, depth = DEPTH) {
  const count = await countTriples({prefixes, where});
  if (count > 0) {
    console.log(`Parsing 0/${count} triples`);
    let offset = 0;
    while (offset < count) {
      await parseBatch(store, {prefixes, where}, offset, depth);
      offset = offset + BATCH_SIZE;
      console.log(`Parsed ${offset < count ? offset : count}/${count} triples`);
    }
  }
}

async function parseBatch(store, {prefixes, where}, offset = 0, depth) {
  const result = await query(`
${prefixes.join('\n')}

SELECT ?s ?p ?o
WHERE {
  GRAPH ?g {
    ${where}
    ?s ?p ?o .
  }
}
LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
  if (result.results.bindings.length) {
    const bindings = result.results.bindings;
    await resolveNestedTypes(store, bindings, depth);
    const ttl = bindings.map(b => selectResultToNT(b['s'], b['p'], b['o'])).join('\n');
    parse(ttl, store);
  }
}

async function resolveNestedTypes(store, bindings, depth) {
  if (depth < 0) {
    const types = bindings.filter(b => b['o'].type === 'uri').map(b => b['o']);
    for (const type of types) {
      await loadDBintoRDFLIBStore(store, {where: `${sparqlEscapeUri(type.value)} ?p ?o .`}, depth--);
    }
  }
}

function selectResultToNT(s, p, o) {
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

async function countTriples({prefixes, where}) {
  const queryResult = await query(`
${prefixes.join('\n')}

SELECT (COUNT(*) as ?count)
WHERE {
  GRAPH ?g {
    ${where}
    ?s ?p ?o .
  }
}`);
  return parseInt(queryResult.results.bindings[0].count.value);
}