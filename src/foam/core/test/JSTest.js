/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.test',
  name: 'JSTest',
  extends: 'foam.core.test.Test',
  abstract: true,

  documentation: 'Abstract base class for modelled JS tests that implement runTest directly.',

  properties: [
    {
      name: 'language',
      factory: function() { return foam.core.script.Language.JS; },
      visibility: foam.u2.DisplayMode.RO
    }
  ]

  /*
  // Add to sub-classes:
  methods: [
    function runTest(x) {
      // insert tests here
    }
  ]
  */

});
