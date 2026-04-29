/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.example',
  name: 'CodeView',
  extends: 'foam.u2.ReadWriteView',
  css: `
    ^readbox {
      border: 1px dashed $borderDefault;
      padding: 1rem;
      text-wrap: auto;
      margin: 0;
      border-radius: 4px;
    }
  `,
  methods: [
    function toReadE() {
      return this.E().start('pre').addClass(this.myClass('readbox')).add(this.data$);
    },

    function toWriteE() {
      this.data$.sub(this.onDataLoad);
      return foam.u2.tag.TextArea.create({rows: 20, cols: 120, escapeTextArea: false, data$: this.data$}, this);
    }
  ]
});
