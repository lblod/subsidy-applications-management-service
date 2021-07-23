import { Graph, parse, serialize } from '../util/rdflib';
import { SemanticFile } from './semantic-file';

export const META_FILE_MATCHER = '-meta.ttl';
export const TAILORED_META_FILE_MATCHER = {
  additions: '-additions-meta.ttl',
};

const META_FILE_REGEX = /meta-files\/.*\/([0-9]{14})-meta\.ttl/;
const TAILORED_META_FILE_REGEX = {
  additions: /tailored-meta-files\/[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}-additions-meta\.ttl/,
};

const GRAPHS = {
  global: 'http://form-meta/global',
  additions: 'http://form-meta/global',
  removals: 'http://form-meta/global',
  content: 'http://form-meta/content',
};

export class SemanticFormMeta {

  static isGlobal(filename) {
    if (filename instanceof SemanticFile) {
      filename = filename.filename;
    }
    return META_FILE_REGEX.test(filename);
  }

  static isTailoredAddition(filename) {
    if (filename instanceof SemanticFile) {
      filename = filename.filename;
    }
    return TAILORED_META_FILE_REGEX.additions.test(filename);
  }

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
    return this.sources.find(file => SemanticFormMeta.isGlobal(file));
  }

  get tailored() {
    const additions = this.sources.find(file => SemanticFormMeta.isTailoredAddition(file));
    const tailored = {};
    if (additions)
      tailored['additions'] = additions;
    return tailored;
  }

  get content() {
    return serialize(this.store, {graph: GRAPHS.content});
  }
}