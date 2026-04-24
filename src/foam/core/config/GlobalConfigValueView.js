/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.config',
  name: 'GlobalConfigValueView',
  extends: 'foam.u2.View',

  documentation: `Dynamic editor for GlobalConfig.value. Renders the input for
    whichever *Value backing property matches the parent's current type, so the
    editor swaps automatically when the type selector changes.`,

  imports: [ 'objData?' ],

  methods: [
    function render() {
      this.SUPER();
      var config = this.objData;
      if ( ! config ) return;
      this.add(config.dynamic(function(type) {
        if ( ! type ) return;
        var axiom = config.cls_.getAxiomByName(type.valueField);
        if ( ! axiom ) return;
        this.startContext({ data: config }).tag(axiom).endContext();
      }));
    }
  ]
});
