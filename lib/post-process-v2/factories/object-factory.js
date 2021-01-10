export class ObjectFactory {

  PREDEFINED = {
    '$ROOT': () => {
      return {value: this._model._root, datatype: 'uri'};
    },
    '$NOW': () => {
      return {value: new Date().toISOString(), datatype: 'dateTime'};
    },
  };

  constructor(model) {
    this._model = model;
  }

  produceObject(object) {
    if (!object) return undefined;
    if (object.value && this.PREDEFINED[object.value]) {
      return this.PREDEFINED[object.value]();
    }
    return object;
  }
}