/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'JavaBlockValidatorTest',
  extends: 'foam.core.test.JSTest',

  methods: [
    async function runTest(x) {
      var index = foam.parse.lsp.FoamIndex.create();
      var validator = foam.parse.lsp.handlers.JavaBlockValidator.create({ index: index });

      // Register a test class
      foam.CLASS({
        package: 'foam.parse.lsp.test',
        name: 'JavaTestModel',
        properties: [
          { class: 'String', name: 'firstName' },
          { class: 'Int', name: 'age' }
        ]
      });

      // Valid getter — no warning
      var diags = [];
      var block = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'JavaTestModel',\n  javaCode: `getFirstName()`\n})";
      validator.validate('foam.parse.lsp.test.JavaTestModel', block, diags, 0, block);
      var firstNameWarnings = diags.filter(function(d) { return d.message.indexOf('firstName') !== -1; });
      x.test(firstNameWarnings.length === 0, 'Valid getter should not be flagged');

      // Invalid getter — should warn
      diags = [];
      var block2 = "foam.CLASS({\n  javaCode: `getNonexistent()`\n})";
      validator.validate('foam.parse.lsp.test.JavaTestModel', block2, diags, 0, block2);
      x.test(diags.some(function(d) { return d.message.indexOf('nonexistent') !== -1; }),
        'Invalid getter should be flagged');

      // Bad import — should error
      diags = [];
      var block3 = "foam.CLASS({\n  javaImports: ['foam.nanos.logger.Logger']\n})";
      validator.validate('foam.parse.lsp.test.JavaTestModel', block3, diags, 0, block3);
      x.test(diags.some(function(d) { return d.message.indexOf('foam.core.logger.Logger') !== -1; }),
        'foam.nanos import should suggest foam.core alternative');
    }
  ]
});
