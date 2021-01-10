import { any } from '../util/database';
import { MappingStrategyFactory } from './factories/mapping-strategy-factory';
import { ResourceEntityFactory } from './factories/resource-entity-factory';

export class ModelBuilder {

  /**
   * Here we define pre-defined objects that the user can access.
   */
  PRE_DEFINED_OBJECTS = {
    '$ROOT': () => {
      return {value: this.root, datatype: 'uri'};
    },
  };

  constructor(root, config) {
    this.mappingStrategyFactory = new MappingStrategyFactory(this);
    this.resourceEntityFactory = new ResourceEntityFactory(this);

    // NOTE: root off the semantic form to be harvested
    this.root = root;
    this.config = config;
    this.resources = {};
  }

  async build() {
    for (const [path, mapping] of Object.entries(this.config.mapping)) {
      try {
        // NOTE: harvest the value for the path
        // TODO: remove sudo by updating the authorization rules
        let object = undefined;
        try {
          object = await any(`<${this.root}>`, `<${path}>`, undefined, {sudo: true});
        } catch (e) {
          console.warn('Query failed, is your database running?');
          console.log(e);
        }
        // NOTE: retrieve a resolve strategy for the given mapping.
        const strategy = this.mappingStrategyFactory.produce(mapping, object);
        strategy.resolve();
      } catch (e) {
        console.warn(`Building off the form failed on path <${path}>.\nReason:`);
        console.log(e);
      }
    }
    return this;
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