import { sparqlEscape } from 'mu';

export const SUBMISSION_STATUSES = {
  sent: 'http://lblod.data.gift/concepts/9bd8d86d-bb10-4456-a84e-91e9507c374c',
  concept: 'http://lblod.data.gift/concepts/79a52da4-f491-4e2f-9374-89a13cde8ecd',
};

// TODO make more solid
export class SemanticForm {

  constructor({graph, uri, uuid, status, source}) {
    this.graph = graph;
    this.uri = uri;
    this.uuid = uuid;
    this.status = status;
    this.source = source;
  }

  get submitted() {
    return this.status === SUBMISSION_STATUSES.sent;
  }

  toNT() {
    let buffer = [];
    if (this.uuid) buffer.push(
        `<${this.uri}> <http://mu.semte.ch/vocabularies/core/> ${sparqlEscape(this.uuid, 'string')} .`);
    if (this.status) buffer.push(
        `<${this.uri}> <http://www.w3.org/ns/adms#status> <${this.source}> .`);
    if (this.source) buffer.push(
        `<${this.uri}> <http://purl.org/dc/terms/source> <${this.source}>.`);
    return buffer.join('\n').trim();
  }

}