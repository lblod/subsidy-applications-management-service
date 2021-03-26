import { META_DATA_ROOT, SEMANTIC_FORM_CONFIGURATION_ROOT } from '../../env';
import { getDirectoriesSync } from '../util/file';
import { SemanticFormConfiguration } from './semantic-form-configuration';
import { GlobalMeta } from './global-meta';

export class SemanticFormFiles {

  constructor(root = SEMANTIC_FORM_CONFIGURATION_ROOT) {
    this.root = root;
    this.configurationByFormURI = {};
    this.metaByFormURI = {};
  }

  async init() {
    const matches = getConfigurationDirSync({name: 'form', path: this.root});
    for (const {name, path} of matches) {
      console.log(`[${name.toUpperCase()}] Initializing configuration for path ${path} ...`);
      const configuration = await new SemanticFormConfiguration({name, path}).init();
      this.configurationByFormURI[configuration.specification.turtle.uri] = configuration;
    }
    return this;
  }

  async getLatest(uri) {

    /**
     * NOTE: retrieving the static form configuration, based on the form URI
     */
    const configuration = this.configurationByFormURI[uri];
    if (!configuration) {
      console.warn(`Couldn't find configuration for <${uri}>`);
      return {
        configuration: undefined,
        meta: undefined,
      };
    }

    /**
     * NOTE: retrieving/spawning the global-meta generation, based on the form URI
     */
    let meta = this.metaByFormURI[uri];
    if (!meta) {
      meta = await new GlobalMeta({root: `${META_DATA_ROOT}${configuration.name}/`, configuration}).init();
      this.metaByFormURI[uri] = meta;
      await meta.trigger();
    }

    /**
     * NOTE: returning the configuration and latest meta.
     */
    return {
      configuration,
      meta: meta.latest,
    };
  }
}

/* PRIVATE FUNCTIONS */

function getConfigurationDirSync(current, matches = []) {
  if (SemanticFormConfiguration.isConfigDir(current.path)) {
    matches.push(current);
  }
  getDirectoriesSync(current.path).map(name => new Object({
    name, path: `${current.path}${name}/`,
  })).forEach(dir => getConfigurationDirSync(dir, matches));
  return matches;
}