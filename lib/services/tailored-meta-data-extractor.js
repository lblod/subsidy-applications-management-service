import { Graph, RDFNode, serialize } from '../util/rdflib';

/**
 * NOTE: temporary way of allowing external user to duse libraries in his extractors.
 */
const lib = {
  '$rdf': require('rdflib'),
  'mu': require('mu'),
  'sudo': require('@lblod/mu-auth-sudo'),
};

/**
 * TODO: removals not yet supported at this stage.
 */
const TAILORED_META_GRAPHS = {
  additions: new RDFNode('http://tailored-meta-data-extractor/additions'),
  removals: new RDFNode('http://tailored-meta-data-extractor/removals'),
};

export class TailoredMetaDataExtractor {

  /**
   * Generates a delta based on the given array of extractors
   *
   * TODO:  could this be done more efficient?
   *
   * @param extractors
   * @returns {Promise<{additions}>}
   */
  async execute(extractors) {
    let store = new Graph();
    for (let extractor of extractors) {
      try {
        await extractor.execute(store, TAILORED_META_GRAPHS, lib);
      } catch (e) {
        console.warn(`Failed to execute extractor for ${extractor.name}`);
        console.log(e);
      }
    }
    return {
      additions: serialize(store, {graph: TAILORED_META_GRAPHS.additions.value})
    };
  }
}