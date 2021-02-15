import { query as muQuery, update as muUpdate, sparqlEscape } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import moment from 'moment';

/**
 *
 * JS file containing all helpers for working with the database
 * - TODO: move to class
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

/**
 * Made for the edge case where you want te ?graph, but ensure you are auth.
 *
 * @param q - query
 * @returns {Promise<null|*|*>}
 */
export async function authenticatedQuery(q) {
  const response = await query(q);
  // NOTE: if nothing was found we could assume we did not have the rights
  const authenticated = response.results.bindings.length > 0;
  if (authenticated) {
    return await query(q, true);
  }
  return null;
}

export function bindingsToNT(bindings) {
  return bindings.map(b => bindingToNT(b['s'], b['p'], b['o']));
}

function bindingToNT(s, p, o) {
  const subject = sparqlEscape(s.value, 'uri');
  const predicate = sparqlEscape(p.value, 'uri');
  let obj;
  if (o.type === 'uri') {
    obj = sparqlEscape(o.value, 'uri');
  } else {
    obj = `${sparqlEscape(o.value, 'string')}`;
    if (o.datatype)
      obj += `^^${sparqlEscape(o.datatype, 'uri')}`;
  }
  return `${subject} ${predicate} ${obj} .`;
}

// TODO: redo with proper escape for URI
export async function statements(
    subject = '?subject',
    predicate = '?predicate',
    object = '?object',
    {
      prefixes = {},
      sudo = false,
    } = {}) {
  {
    const response = await query(`
${Object.entries(prefixes).map(([title, uri]) => `PREFIX ${title}: <${uri}>`).join('\n').trim()}  // TODO redo with proper escape

SELECT *
WHERE {
  ${subject} ${predicate} ${object} .
}`, sudo);
    if (response.results && response.results.bindings) {
      return response.results.bindings.flatMap(binding => Object.values(binding));
    }
    return [];
  }
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
      console.log(`Max retry of ${moment.duration(REQUEST_BACKOFF_MAX_RETRY_WAIT).
          humanize()} was reached, are you sure the database is running?`);
      throw Error(e);
    }
  }
}