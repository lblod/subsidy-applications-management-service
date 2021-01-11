export class ObjectEntityFactory {

  PRE_DEFINED_OBJECTS = {
    '$NOW': () => {
      return {value: new Date().toISOString(), datatype: 'dateTime'};
    },
  };

  /**
   * TODO not sure about the naming.
   *  It just "parses" pre-defined object values, not "produce" new object entities based on given "instructions"
   */
  constructor(property) {
    this.property = property;
    // NOTE: we retrieve pre-defined markers from the model object
    Object.entries(property.resource.model.PRE_DEFINED_OBJECTS).forEach(([key, definition]) => {
      this.PRE_DEFINED_OBJECTS[key] =definition;
    });
  }

  produce(object) {
    if (!object) return undefined;
    if (object.value && this.PRE_DEFINED_OBJECTS[object.value]) {
      return this.PRE_DEFINED_OBJECTS[object.value]();
    }
    return object;
  }
}