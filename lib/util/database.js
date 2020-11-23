import { query, sparqlEscapeString } from 'mu';

export async function getSubject(uuid, type = undefined) {
  const response = await query(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?subject
WHERE {
    ?subject mu:uuid ${sparqlEscapeString(uuid)} .
    ${type ? `?subject rdf:type <${type}> .` : ''}
}`);
  if (response.results.bindings.length) {
    return response.results.bindings[0].subject.value;
  } else {
    throw {
      status: 404,
      message: `Could not access or retrieve the resource for UUID "${uuid}".`,
    };
  }
}

