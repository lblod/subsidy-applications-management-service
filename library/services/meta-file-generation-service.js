import { uriToPath } from '../../lib/util/file';
import { COMMON_GRAPHS, NTriplesMutationService } from '../../lib/services/n-triples-mutation-service';
import { query } from '../../lib/util/database';
import Base64 from 'crypto-js/enc-base64';
import sha256 from 'crypto-js/sha256';
import { FilePOJO } from '../entities/file-pojo';
import { VersionedConfigurationSyncService } from './configuration-versioning-service';

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
 * - massive TODO
 */
export class MetaFileGenerationService {

  constructor() {
    this.versionService = new VersionedConfigurationSyncService();
    this.mutationService = new NTriplesMutationService({sudo: true});
    this.latest = '';
  }

  async synchronize() {
    const latest_meta_contents = await this.generate();
    // TODO put this in a helper (the hashing)
    const latest_meta_contents_hash = Base64.stringify(sha256(latest_meta_contents));

    // TODO find generated
    const current_meta_file = await getCurrent();
    if(current_meta_file.hash === latest_meta_contents_hash) {
      // NOTE: nothing should happen
      return current_meta_file;
    }
    // TODO create new if needed
    const new_meta_file = new FilePOJO({
      filename: 'TODO',
      created: 'TODO',
      modified: 'TODO',
      hash: latest_meta_contents_hash
    });
    // TODO save to disk
    FilePOJO.overrideContence(latest_meta_contents);
    await this.mutationService.insert(COMMON_GRAPHS.public, new_meta_file.toNT());
  }

  async generate() {
    const dir = this.versionService.active.uri;
    const schemes = require(this.versionService.getCurrent().form).meta['concept-schemes'];
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