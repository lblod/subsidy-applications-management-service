import { any } from '../util/database';
import { Model } from './entities/model';
import { MappingStrategyFactory } from './factories/mapping-strategy-factory';
import { DeclarationsParser } from './declarations-parser';

export class FormToModelMapper {

  /**
   * TODO
   * Here we define pre-defined objects that the user can access.
   */
  PRE_DEFINED_OBJECTS = {
    '$ROOT': () => {
      return {value: this.root, datatype: 'uri'};
    },
  };

  constructor(root, config) {
    this.root = root;
    this.prefixes = config.prefixes;
    this.routes = config.routes;
    this.declarations = config.resource_declarations;

    this.declarationsParser = new DeclarationsParser(this.PRE_DEFINED_OBJECTS);
  }

  async build() {
    // NOTE: resolve the declarations
    this.declarationsParser.parse(this.declarations);
    const model = new Model(this.prefixes, this.declarations);

    // NOTE: resolve the routes
    for (const [path, config] of Object.entries(this.routes)) {
      try {
        // NOTE: harvest the value for the given path
        // TODO: remove sudo by updating the authorization rules
        let object = undefined;
        try {
          object = await any(`<${this.root}>`, `${path}`, undefined, {prefixes: this.prefixes, sudo: true});
        } catch (e) {
          console.warn('Query failed, is your database running?');
          console.log(e);
        }
        // NOTE: retrieve a resolve strategy for the given mapping.
        if(object) {
          const strategy = MappingStrategyFactory.produce(config);
          strategy.map(object, model);
        } else{
          console.log(`${path} was ignored. Reason: no object for path`);
        }
      } catch (e) {
        throw new Error(`Building off the model for <${this.root}> failed on path ${path}.\nReason: ${e.message}`);
      }
    }
    return model;
  }
}