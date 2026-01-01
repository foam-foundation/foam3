/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'CSSTokenRefinement',
  refines: 'foam.u2.CSSToken',

  properties: [
    {
      name: 'javaValue',
      expression: function(javaType, name, value, variants, variantKey) {
        return "new "+javaType+"(\""+name+"\",\""+value+"\","+foam.java.asJavaValue(variants)+",\""+variantKey+"\");";
      }
    },
    {
      class: 'foam.java.JavaType',
      value: 'foam.u2.CSSToken'
    } // JavaType defines 'name' and other properties
  ],

  javaCode: `
  public CSSToken(String name, String value, java.util.Map variants, String variantKey) {
    setName(name);
    setValue(value);
    setVariants(variants);
    setVariantKey(variantKey);
  }
  `,

  methods: [
    function buildJavaClass(cls) {
      cls.constant({
        name: foam.String.constantize(this.name),
        type: this.javaType,
        value: this.javaValue,
        documentation: this.documentation
      });
    }
  ]
});
