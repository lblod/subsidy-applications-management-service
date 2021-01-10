import { query as muQuery, update as muUpdate, sparqlEscapeString } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import moment from 'moment';

/**
 * JS file containing all helpers for working with the database
 */

const REQUEST_BACKOFF_INITIAL_RETRY_WAIT = 50;
const REQUEST_BACKOFF_RATE = 0.3;
const REQUEST_BACKOFF_MAX_RETRY_WAIT = 600000; // 10 min

export async function query(q, sudo = false) {
  return sudo ? await querySudo(q) : await muQuery(q);
}

export async function update(q, sudo = false) {
  return sudo ? await updateSudo(q) : await muUpdate(q);
}

export async function any(subject = undefined, predicate = undefined, object = undefined, sudo = false) {
  subject = subject ? subject : '?subject';
  predicate = predicate ? predicate : '?predicate';
  object = object ? object : '?object';
  const response = await query(`
  SELECT *
  WHERE {
    ${subject} ${predicate} ${object} .
  }
  `, sudo);
  if (response.results.bindings && response.results.bindings.length > 0) {
    return Object.entries(response.results.bindings[0])[0][1];
  }
  return undefined; // TODO how do we handle this
}

export async function waitForDatabase(attempt = 0) {
  try {
    await query(`
SELECT ?s WHERE {
  ?s ?p ?o .
} 
LIMIT 1`, true);
  } catch (e) {
    const timeout = Math.round((REQUEST_BACKOFF_INITIAL_RETRY_WAIT * Math.pow(1 + REQUEST_BACKOFF_RATE, attempt)));
    if (timeout < REQUEST_BACKOFF_MAX_RETRY_WAIT) {
      ++attempt;
      console.log('Waiting for database ...');
      await new Promise(r => setTimeout(r, timeout));
      await waitForDatabase(attempt);
    } else {
      console.log(`Max retry off ${moment.duration(REQUEST_BACKOFF_MAX_RETRY_WAIT).
          humanize()} was reached, are you sure the database is running?`);
      throw Error(e);
    }
  }
}

export async function getSubject(uuid, type = undefined, {sudo = false} = {}) {
  const response = await query(`
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?subject
WHERE {
    ?subject mu:uuid ${sparqlEscapeString(uuid)} .
    ${type ? `?subject rdf:type <${type}> .` : ''}
}`, sudo);
  if (response.results.bindings.length) {
    return response.results.bindings[0].subject;
  } else {
    throw {
      status: 400,
      message: `Could not access or retrieve the resource for UUID "${uuid}".`,
    };
  }
}
