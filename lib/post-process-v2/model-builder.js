import CONFIGURATION from '../../semantic-form-to-model';
import { any } from '../util/database';
import { ResourceFactory } from './factories/resource-factory';
import { ResolverFactory } from './factories/resolver-factory';

export class ModelBuilder {

  constructor(root) {
    // NOTE: root off the semantic form to be harvested
    this._root = root;
    this._configuration = CONFIGURATION; // TODO be versioned?
    this._resources = {};

    this._resolverFactory = new ResolverFactory(this);
    this._resourceFactory = new ResourceFactory(this);
  }

  async build() {
    for (const path of this._configuration.paths) {

      // NOTE: harvest the value for the path
      const binding = await any(`<${this._root}>`, `<${path}>`, undefined, {sudo: true});

      // NOTE: we only continue if we could find a value for the path
      if (binding) {
        const resolve = this._resolverFactory.produceResolver(this._configuration.resolutions[path], binding.object);
        resolve();
      }
    }
    return this;
  }

  addResource(key, value) {
    this._resources[key] = value;
  }

  getResource(key) {
    if (!this._resources[key]) {
      this.addResource(key, this._resourceFactory.produceResource(this._configuration.resources[key]));
    }
    return this._resources[key];
  }

  toNT() {
    console.log(this._resources);
    console.log(Object.keys(this._configuration.resources));
    console.log(Object.keys(this._resources));
    console.log(this);
    let temp = [];
    for( const key in this._resources) {
      if (this._resources.hasOwnProperty(key)) {
        temp.push(this._resources[key].toNT());
      }
    }
    return temp.join('\n\n').trim()
  }

}