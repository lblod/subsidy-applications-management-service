import { sparqlEscape } from 'mu';
import { SemanticFile } from './semantic-file';
import { SEMANTIC_FORM_TYPE } from '../../env';

export const SEMANTIC_FORM_STATUS = {
  SENT: 'http://lblod.data.gift/concepts/9bd8d86d-bb10-4456-a84e-91e9507c374c',
  CONCEPT: 'http://lblod.data.gift/concepts/79a52da4-f491-4e2f-9374-89a13cde8ecd',
};

/**
 *  Class representation off a semantic-form
 */
export class SemanticForm {

  constructor({graph, uri, uuid, status, sources = [], type = SEMANTIC_FORM_TYPE} = {}) {
    this.type = type;
    this.graph = graph;
    this.uri = uri;
    this.uuid = uuid;
    this.status = status;
    this.sources = sources;
  }

  get submitted() {
    return this.status === SEMANTIC_FORM_STATUS.SENT;
  }

  set sources(sources) {
    this._sources = sources.map(source => {
      if (typeof source === 'string' || source instanceof String) {
        return new SemanticFile({uri: source});
      }
      return source;
    });
  }

  get sources() {
    return this._sources;
  }

  getSource(matcher) {
    return this.sources.find(file => file.filename.includes(matcher));
  }

  /**
   * Returns the POJO class as a valid n-triples.
   *
   * Manly used to (C)RUD the POJO using the {@link NTriplesMutator}. Make sure it is up-to-date.
   */
  toNT() {
    let buffer = [];

    const prefixes = [
      '@prefix mu: <http://mu.semte.ch/vocabularies/core/> .',
      '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
      '@prefix adms: <http://www.w3.org/ns/adms#>  .',
      '@prefix dct: <http://purl.org/dc/terms/> .',
    ];

    buffer.push(prefixes.join('\n'));

    buffer.push(`<${this.uri}> a <${this.type}> .`);
    if (this.uuid)
      buffer.push(`<${this.uri}> mu:uuid ${sparqlEscape(this.uuid, 'string')} .`);
    if (this.status)
      buffer.push(`<${this.uri}> adms:status <${this.status}> .`);
    this.sources.forEach(source => {
      buffer.push(`<${this.uri}> dct:source <${source.uri}> .`);
    });

    return buffer.join('\n').trim();
  }

}