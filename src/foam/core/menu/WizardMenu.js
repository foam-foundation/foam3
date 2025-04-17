/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'WizardMenu',
  extends: 'foam.core.menu.AbstractMenu',

  requires: [
    'foam.util.async.Sequence',
    'foam.u2.crunch.WizardRunner',
    'foam.u2.crunch.EasyCrunchWizard'
  ],

  properties: [
    {
      class: 'foam.util.FObjectSpec',
      name: 'source',
      documentation: 'Either a capability, string or WizardFlow',
      adapt: function(o,n) {
        // Override default behaviour since this prop can accept string
        return n;
      }
    },
    {
      class: 'Object',
      of: 'foam.u2.crunch.EasyCrunchWizard',
      name: 'config',
      type: 'foam.lib.json.UnknownFObject',
      javaJSONParser: 'new foam.lib.json.UnknownFObjectParser()',
      includeInDigest: false,
      factory: function() {
        return {
          class: 'foam.u2.crunch.EasyCrunchWizard'
        }
      }
    },
    {
      class: 'Boolean',
      name: 'tryInline'
    }
  ],

  methods: [
    function launch(x, menu) {
      const runner = this.WizardRunner.create({
        source: foam.String.isInstance(this.source) ? this.source : this.source$create({}, x),
        isInline: this.tryInline
      }, x)

      runner.sequence.addBefore('ConfigureFlowAgent', this.config)
      runner.launch()
    }
  ]
});
