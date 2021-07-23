import { META_DATA_ROOT, SEMANTIC_FORM_CONFIGURATION_ROOT } from '../../env';
import { getDirectoriesSync } from '../util/file';
import { SemanticFormConfiguration as Configuration } from '../entities/semantic-form-configuration';
import { GlobalMeta } from './global-meta';
import { DirectorySynchronizer } from './directory-synchronizer';

export class SemanticFormSources {

  constructor(root = SEMANTIC_FORM_CONFIGURATION_ROOT) {
    this.root = root;

    /**
     * Map of configuration for each form URI
     */
    this.configurationByFormURI = {};

    /**
     * Map of meta for each form URI
     */
    this.metaByFormURI = {};
  }

  /**
   * TODO docs
   *
   * @returns {Promise<SemanticFormSources>}
   */
  async init() {
    const matches = getConfigurationDirectoriesSync({name: 'form', path: this.root});

    /**
     * Stop the service if no semantic-form-configuration directories could be found
     */
    if (!matches.length)
      throw 'Missing semantic-form-configuration directories';

    for (const {name, path} of matches) {
      console.log(`Found semantic-form-configuration for \`${path}\``);

      /**
       * NOTE: we sync up the versioned files and initialize a configuration for each unique form spec.
       */
      const versioned = await new DirectorySynchronizer(Configuration.getVersionedDir(path)).init();
      for (const [created, sources] of Object.entries(versioned.filesByCreated)) {
        const configuration = new Configuration({name, root: path, sources});
        this.configurationByFormURI[configuration.specification.turtle.uri] = configuration;
      }
      console.log(`Ingestion of semantic-form-configuration for \`${path}\` completed.`);
    }
    return this;
  }

  /**
   * TODO docs
   *
   * @param uri
   * @returns {*}
   */
  getConfiguration(uri) {
    /**
     * NOTE: retrieving the static form configuration, based on the form URI
     */
    const configuration = this.configurationByFormURI[uri];
    if (!configuration) {
      throw {
        status: 404,
        message: `Couldn't find configuration for <${uri}>`,
      };
    }
    return configuration;
  }

  /**
   * TODO docs
   * @returns {Promise<void>}
   */
  async syncAllMeta() {
    for (const [uri, configuration] of Object.entries(this.configurationByFormURI)) {
      await this.getMeta(uri, configuration);
    }
  }

  /**
   * TODO docs
   *
   * @param uri
   * @param configuration
   * @returns {Promise<undefined|SemanticFile|string|*>}
   */
  async getMeta(uri, configuration = this.getConfiguration(uri)) {
    /**
     * NOTE: retrieving/spawning the global-meta generation, based on the form URI
     */
    let meta = this.metaByFormURI[uri];
    if (!meta) {
      const root = `${META_DATA_ROOT}${configuration.name}/${configuration.specification.turtle.uuid}/`;
      meta = await new GlobalMeta({root, configuration}).init();
      this.metaByFormURI[uri] = meta;
    }
    /**
     * NOTE: trigger the meta to ensure the generation job is active
     */
    await meta.trigger();

    return meta.latest;
  }

  /**
   * TODO make this return a form bundle
   * @param uri
   * @returns {Promise<{configuration: *, meta: Promise<undefined|SemanticFile|string|*>}>}
   */
  async getLatest(uri) {

    const configuration = this.getConfiguration(uri);
    let meta = undefined;
    if (GlobalMeta.isEligible(configuration))
      meta = await this.getMeta(uri, configuration);

    // TODO should the tailored meta-data be generated here?

    /**
     * NOTE: returning the configuration and latest meta.
     */
    return {
      configuration,
      meta,
    };
  }
}

/* PRIVATE FUNCTIONS */

/**
 * Returns a list off all the directories who qualify as a semantic-form-configuration directory.
 *
 * @param current
 * @param matches
 * @returns {*[]}
 */
function getConfigurationDirectoriesSync(current, matches = []) {
  if (Configuration.isConfigDir(current.path)) {
    matches.push(current);
  }
  getDirectoriesSync(current.path).map(name => new Object({
    name, path: `${current.path}${name}/`,
  })).forEach(dir => getConfigurationDirectoriesSync(dir, matches));
  return matches;
}