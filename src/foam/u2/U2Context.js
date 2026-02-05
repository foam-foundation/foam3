/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'U2Context',

  documentation: 'Context which includes U2 functionality. Replaces foam.__context__.',

  exports: [
    'E',
    'registerElement',
    'elementForName'
  ],

  properties: [
    {
      name: 'elementMap',
      documentation: 'Map of registered Elements.',
      factory: function() { return {}; }
    }
  ],

  methods: [
    {
      // A Method which has the call-site context added as the first arg
      // when exported.
      class: 'foam.lang.ContextMethod',
      name: 'E',
      code: function E(ctx, opt_nodeName, opt_args) {
        var nodeName = opt_nodeName ? opt_nodeName.toLowerCase() : 'div';
        var args     = opt_args || {};

        // Check if a class has been registered for the specified nodeName
        var cls = ctx.elementForName(nodeName);

        if ( ! cls ) {
          args.nodeName = nodeName;
          cls = foam.u2.Element;
        }

        return cls.create(args, ctx);
      }
    },

    function registerElement(elClass, opt_elName) {
      /* Register a View class against an abstract node name. */
      var key = opt_elName || elClass.name;
      this.elementMap[key.toLowerCase()] = elClass;
    },

    function elementForName(nodeName) {
      /* Find an Element Class for the specified node name. */
      return this.elementMap[nodeName];
    }
  ]
});


foam.SCRIPT({
  package: 'foam.u2',
  name: 'U2ContextScript',

  requires: [ 'foam.u2.U2Context' ],
  flags: ['web'],

  code: function() {
    foam.__context__ = foam.u2.U2Context.create().__subContext__;
  }
});
