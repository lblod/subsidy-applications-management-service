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
const TAILORED_DATA_GRAPHS = {
  additions: new RDFNode('http://tailored-data-extractor/additions'),
  removals: new RDFNode('http://tailored-data-extractor/removals'),
};

export class TailoredMetaDataExtractor {

  constructor(form = undefined) {
    this.form = form;
  }

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
        await extractor.execute(store, TAILORED_DATA_GRAPHS, lib, this.form);
      } catch (e) {
        console.warn(`Failed to execute extractor for ${extractor.name}`);
        console.log(e);
      }
    }
    return {
      additions: serialize(store, {graph: TAILORED_DATA_GRAPHS.additions.value})
    };
  }
}