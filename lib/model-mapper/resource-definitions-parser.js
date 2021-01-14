export class ResourceDefinitionsParser {

  /**
   * Default pre-defined objects
   */
  PRE_DEFINED_OBJECTS = {
    '$NOW': () => {
      return {value: new Date().toISOString(), datatype: 'dateTime'};
    },
  };

  constructor(definitions) {
    // NOTE: we retrieve pre-defined markers from the model
    Object.entries(definitions).forEach(([key, definition]) => {
      this.PRE_DEFINED_OBJECTS[key] = definition;
    });
  }

  parse(definitions) {
    Object.values(definitions).forEach(definition => {
          if (definition.properties) {
            definition.properties.forEach(prop => {
              if (prop.object && this.PRE_DEFINED_OBJECTS[prop.object]) {
                prop.object = this.PRE_DEFINED_OBJECTS[prop.object]();
              }
            });
          }
        },
    );
  }
}