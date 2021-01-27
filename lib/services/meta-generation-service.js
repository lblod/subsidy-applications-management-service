import { uriToPath } from '../util/file';
import { query } from '../util/database';
import { NTriplesMutationService } from './n-triples-mutation-service';

const TEMPLATE_CONCEPT_CONFIG = {
  prefixes: [
    'PREFIX skos: <http://www.w3.org/2004/02/skos/core#>',
  ],
  properties: [
    'skos:inScheme',
    'skos:prefLabel',
  ],
};

/**
 * Very crude implementation off what a MetaGenerationService could look like
 */
export class MetaGenerationService {

  constructor(versionService) {
    this.versionService = versionService;
    this.mutationService = new NTriplesMutationService({sudo: true});
  }

  async generate() {
    const dir = this.versionService.active.uri;
    const schemes = require(uriToPath(`${dir}/config.json`)).meta['concept-schemes'];
    let buffer = '';
    try {
      for (const scheme of schemes) {
        // NOTE: get all concept URI's for the scheme
        const response = await query(`
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      SELECT ?concept
      WHERE {
        ?concept skos:inScheme <${scheme}> .
      }
      `, true);
        if (response.results.bindings.length) {
          for (const binding of response.results.binding) {
            TEMPLATE_CONCEPT_CONFIG['node'] = binding.concept;
            buffer = await this.mutationService.generate(TEMPLATE_CONCEPT_CONFIG, buffer);
          }
        } else {
          console.warn(`concept-scheme <${scheme}> ignored.\nReason: no concepts found.`);
        }
      }
      return buffer;
    } catch (e) {
      console.warn(e);
      throw "Generation off meta-data failed unexpectedly";
    }

  }
}