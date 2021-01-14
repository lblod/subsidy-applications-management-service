import { statements } from '../util/database';
import { Model } from './entities/model';
import { MappingStrategyFactory } from './factories/mapping-strategy-factory';

export class ModelMapper {

  /**
   * Here we define pre-defined objects that the user can access.
   */
  PRE_DEFINED_OBJECTS = {
    '$ROOT': () => {
      return {value: this.root, datatype: 'uri'};
    },
  };

  constructor(model = new Model(), {sudo = false} = {}) {
    this.model = model;
    this.sudo = sudo;

    // TODO this responsibility should really be moved to the model.
    // this.resourceDefinitionsParser = new ResourceDefinitionsParser(this.PRE_DEFINED_OBJECTS);
    // this.resourceDefinitionsParser.parse(this.model.definitions);
  }

  async map(root, mapping) {
    // NOTE: resolve the routes
    for (const directions of mapping) {
      try {
        // NOTE: harvest the value for the given path
        let objects = [];
        try {
          const options = {prefixes: this.model.prefixes, sudo: this.sudo};
          objects = await statements(`<${root}>`, `${directions.from}`, undefined, options);
        } catch (e) {
          console.warn('Query failed, is your database running?');
          console.log(e);
        }
        // NOTE: retrieve a resolve strategy for the given mapping.
        if (objects.length) {
          const strategy = MappingStrategyFactory.produce(directions);
          objects.forEach(object => strategy.map(object, this.model));
        } else {
          console.log(
              `Mapping for <${root}> from ${directions.from} was ignored.\nReason: no objects found for given mapping directions`);
        }
      } catch (e) {
        throw new Error(`Mapping for <${root}> from ${directions.path}.\nReason: ${e.message}`);
      }
    }
    return this.model;
  }
}