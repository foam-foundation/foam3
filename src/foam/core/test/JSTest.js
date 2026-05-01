/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.test',
  name: 'JSTest',
  extends: 'foam.core.test.Test',
  abstract: false,
  documentation: `Abstract base class for modelled JS tests that implement runTest directly.
Also for JS only modelled tests that do not support java:
- use pom flags: 'js'
- in tests.jrl use:
    class: foam.core.test.JSTest
    source: to the modelled class id
Test.runScript will test for this combination and create an instance of
'source' and call 'runTest' on it.
`,
  properties: [
    {
      name: 'language',
      factory: function() { return foam.core.script.Language.JS; },
      javaFactory: 'return foam.core.script.Language.JS;',
      visibility: foam.u2.DisplayMode.RO
    },
    {
      class: 'String',
      name: 'source',
      tableWidth: 300,
      transient: false,
      visibility: 'RO',
      factory: function() { return this.cls_.id },
      documentation: 'See Test.runScript(). JSTests '
    },
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
