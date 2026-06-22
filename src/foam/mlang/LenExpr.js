/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/
 
foam.CLASS({
  package: 'foam.mlang',
  name: 'LenExpr',
  extends: 'foam.mlang.AbstractExpr',

  axioms: [
    { class: 'foam.pattern.Singleton' }
  ],

  // todo: support length of other types like maps, collections etc.
  methods: [
    {
      name: 'f',
      code: function(o) {
        return o?.length || 0;
      },
      javaCode: `
        if ( obj == null ) return 0;
        if ( obj instanceof foam.lang.FObject[] ) return ((foam.lang.FObject[]) obj).length;
        return 0;
      `
    }
  ]
});
