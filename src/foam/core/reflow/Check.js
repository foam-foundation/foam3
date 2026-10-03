/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CheckView',
  extends: 'foam.u2.View',

  css: `
    << .foam-u2-ActionView {
      margin-left: 24px;
      height: 24px;
    }
  `,

  methods: [
    function render() {
      this.
        addClass().
        add(this.data.label$, ': ', this.data.CHECKED);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Check',
//  extends: 'foam.u2.Controller',

  properties: [
    {
      class: 'String',
      name: 'label'
    },
    {
      class: 'Boolean',
      name: 'checked'
    },
  ],

  methods: [
    function addToE(e) {
      e.tag(foam.core.reflow.CheckView, {data: this});
    }
  ]
});
