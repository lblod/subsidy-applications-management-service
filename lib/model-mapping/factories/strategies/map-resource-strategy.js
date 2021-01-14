export class MapResourceStrategy {

  constructor(strategy) {
    this.strategy = strategy;
  }

  map(object, model) {
    const resource = model.get(this.strategy.as);
    resource.uri = object.value;
  }
}