export class DeclarationsParser {

  PRE_DEFINED_OBJECTS = {
    '$NOW': () => {
      return {value: new Date().toISOString(), datatype: 'dateTime'};
    },
  };

  /**
   * TODO not sure about the naming.
   *  It just "parses" pre-defined object values, not "produce" new object entities based on given "instructions"
   */
  constructor(definitions) {
    // NOTE: we retrieve pre-defined markers from the model
    Object.entries(definitions).forEach(([key, definition]) => {
      this.PRE_DEFINED_OBJECTS[key] = definition;
    });
  }

  parse(decelerations) {
    Object.values(decelerations).forEach(declaration => {
          if (declaration.properties) {
            declaration.properties.forEach(prop => {
              if (prop.object && this.PRE_DEFINED_OBJECTS[prop.object]) {
                prop.object = this.PRE_DEFINED_OBJECTS[prop.object]();
              }
            });
          }
        },
    );
  }
}