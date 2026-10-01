/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.dialog',
  name: 'PopupSectionView',
  extends: 'foam.u2.detail.SectionView',

  css: `
    ^main {
      padding: 24px;
      min-width: 380px;
      box-sizing: border-box;
    }
    ^main ^rows {
      gap: 16px;
    }
    ^main ^actionDiv {
      align-self: stretch;
      margin-top: 8px;
      gap: 12px;
    }
    ^section-title.h600 {
      font-size: 2rem;
      line-height: 1.3;
      margin: 0;
      padding-right: 32px;
    }
  `,

  methods: [
    function render() {
      this.addClass(this.myClass('main'));
      this.SUPER();
    }
  ]
});