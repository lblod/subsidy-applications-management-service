import { query as muQuery, update as muUpdate, sparqlEscapeString } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';

// TODO re-use
export async function query(q, sudo = false) {
  return sudo ? await querySudo(q) : await muQuery(q);
}

// TODO re-use
export async function update(q, sudo = false) {
  return sudo ? await updateSudo(q) : await muUpdate(q);
}

export async function getSubject(uuid, type = undefined, {sudo = false} = {}) {
  const response = await query(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?subject
WHERE {
    ?subject mu:uuid ${sparqlEscapeString(uuid)} .
    ${type ? `?subject rdf:type <${type}> .` : ''}
}`);
  if (response.results.bindings.length) {
    return response.results.bindings[0].subject;
  } else {
    throw {
      status: 400,
      message: `Could not access or retrieve the resource for UUID "${uuid}".`,
    };
  }
}

export async function isSubject(uri, {sudo = false} = {}) {
  const response = await query(`
SELECT ?p
WHERE {
  <${uri}> ?p ?o.
}`, sudo);
  return response.results.bindings.length;
}
