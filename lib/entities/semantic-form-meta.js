import { Graph, parse, serialize } from '../util/rdflib';

export const META_FILE_MATCHER = '-meta.ttl';
export const TAILORED_META_FILE_MATCHER = {
  additions: '-additions-meta.ttl',
};

const GRAPHS = {
  global: 'http://form-meta/global',
  additions: 'http://form-meta/global',
  removals: 'http://form-meta/global',
  content: 'http://form-meta/content',
};

export class SemanticFormMeta {

  constructor(sources) {
    this.sources = sources;

    /* Initialize store with meta TTL */
    this.store = new Graph();
    if (this.global) {
      parse(this.global.content, this.store, {graph: GRAPHS.content});
    }
    if (this.tailored.additions) {
      parse(this.tailored.additions.content, this.store, {graph: GRAPHS.content});
    }
  }

  get global() {
    return this.sources.find(file => file.filename.includes(META_FILE_MATCHER));
  }

  get tailored() {
    const additions = this.sources.find(file => file.filename.includes(TAILORED_META_FILE_MATCHER.additions));
    const tailored = {};
    if (additions)
      tailored['additions'] = additions;
    return tailored;
  }

  get content() {
    return serialize(this.store, {graph: GRAPHS.content});
  }
}