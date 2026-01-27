/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'ColorTokenRefinement',
  refines: 'foam.u2.ColorToken',

  properties: [
    {
      name: 'javaValue',
      expression: function(javaType, name, value, fallback) {
        return "new "+javaType+"(\""+name+"\",\""+value+"\",\""+fallback+"\");";
      }
    },
    {
      class: 'foam.java.JavaType',
      value: 'foam.u2.ColorToken'
    } // JavaType defines 'name' and other properties
  ],


  javaCode: `
  public ColorToken(String name, String value, String fallback) {
    setName(name);
    setValue(value);
    setFallback(fallback);
  }
  `,

  methods: [
    function buildJavaClass(cls) {
      cls.constant({
        name: foam.String.constantize(this.name),
        type: this.javaType,
        value: this.javaValue,
        falback: this.fallback,
        documentation: this.documentation
      });
    }
  ]
});
