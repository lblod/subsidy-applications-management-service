import { any } from '../util/database';
import { MappingStrategyFactory } from '../factories/mapping-strategy-factory';
import { ResourceEntityFactory } from '../factories/resource-entity-factory';

export class ModelBuilder {

  /**
   * Here we define pre-defined objects that the user can access.
   */
  PRE_DEFINED_OBJECTS = {
    '$ROOT': () => {
      return {value: this.root, datatype: 'uri'};
    },
  };

  constructor(root, config, options) {
    this.mappingStrategyFactory = new MappingStrategyFactory(this);
    this.resourceEntityFactory = new ResourceEntityFactory(this);

    // NOTE: root off the semantic form to be harvested
    this.root = root;
    this.config = config;
    this.options = options;
    this.resources = {};
  }

  async build() {

    // NOTE: resolve the configuration
    for (const [path, mapping] of Object.entries(this.config.mapping)) {
      try {
        // NOTE: harvest the value for the path
        // TODO: remove sudo by updating the authorization rules
        let object = undefined;
        try {
          object = await any(`<${this.root}>`, `${path}`, undefined, this.options);
        } catch (e) {
          console.warn('Query failed, is your database running?');
          console.log(e);
        }
        // NOTE: retrieve a resolve strategy for the given mapping.
        const strategy = this.mappingStrategyFactory.produce(mapping, object);
        strategy.resolve();
      } catch (e) {
        console.warn(`Building off the form failed on path ${path}.\nReason:`);
        console.log(e);
      }
    }

    // NOTE: post-processing off the model (manly to resolve references)
    await this.resolve();

    return this;
  }

  async resolve(pre =  Object.values(this.resources)){
    for (const resource of pre) {
      await resource.resolve();
    }
    const post = Object.values(this.resources);
    if(pre.length !== post.length) {
      await this.resolve(post);
    }
  }

  set resource({key, value}) {
    this.resources[key] = value;
  }

  getResource(key) {
    if (!this.resources[key]) {
      this.resource = {key, value: this.resourceEntityFactory.produce(key)};
    }
    return this.resources[key];
  }

  toNT() {
    return Object.entries(this.resources).map(([key, resource]) => resource.toNT()).join('\n\n').trim();
  }

}