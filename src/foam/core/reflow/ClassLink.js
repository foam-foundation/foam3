/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ClassLink',
  extends: 'foam.u2.View',

  documentation: 'Replacement for foam.doc.ClassLink which calls describe() instead of linking to standard doc browser.',

  imports: [ 'eval_' ],

  properties: [
    [ 'nodeName', 'a' ],
    {
      class: 'Class',
      name: 'data'
    },
    {
      class: 'Boolean',
      name: 'showPackage'
    }
  ],

  methods: [
    function render() {
      this.SUPER();

      this.
        on('click', this.click).
        attrs({href: this.data.id}).
        add(this.showPackage ? this.data.id : this.data.name);
    }
  ],

  listeners: [
    function click(e) {
      this.eval_('describe ' + this.data.id);
      e.preventDefault();
    }
  ]
});
