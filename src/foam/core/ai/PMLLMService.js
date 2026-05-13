/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai',
  name: 'PMLLMService',
  extends: 'foam.core.ai.ProxyLLMService',

  implements: [
    'foam.core.auth.EnabledAware',
    'foam.core.boot.CSpecAware'
  ],

  requires: [
    'foam.core.pm.PM'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.core.pm.PM'
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'enabled',
      value: true
    },
    {
      name: 'name',
      class: 'String',
      javaFactory: `
      foam.core.boot.CSpec nspec = getCSpec();
      if ( nspec != null ) {
        return nspec.getName();
      }
      return "";
      `
    },
    {
      name: 'cSpec',
      class: 'FObjectProperty',
      type: 'foam.core.boot.CSpec'
    }
  ],

  methods: [
    {
      name: 'getNameFor',
      args: 'String fname',
      type: 'String',
      javaCode: `
        String name = getName();
        return ("".equals(name) ? "" : "/" + name) + ":" + fname;
      `
    },
    {
      name: 'complete',
      javaCode: `
        PM pm = null;
        if ( getEnabled() ) pm = PM.create(x, this.getClass(), getNameFor("complete"));
        try {
          return super.complete(x, request);
        } finally {
          if ( pm != null ) pm.log(x);
        }
      `
    },
    {
      name: 'chat',
      javaCode: `
        PM pm = null;
        if ( getEnabled() ) pm = PM.create(x, this.getClass(), getNameFor("chat"));
        try {
          return super.chat(x, messages, options);
        } finally {
          if ( pm != null ) pm.log(x);
        }
      `
    }
  ]
});
