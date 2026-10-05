/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'FUIDSearch',
  extends: 'foam.u2.View',
  requires: [
    'foam.u2.view.GlobalFuidSearch'
  ],
  css: `
    <<{
      display: flex;
      flex-direction: column;
      gap: 16px;
      height: 100%;
      justify-content: flex-start;
      padding: 36px 16px 8px 16px;
    }
    <<search {
      align-self: center;
      width: 75%;
    }
    @media only screen and (min-width: 768px) {
      <<{
        padding: 24px 32px 16px 32px;
      }
    }
  `,
  messages: [
    { name: 'TITLE', message: 'FUID Search' }
  ],

  properties: [
    {
      name: 'viewTitle',
      value: 'FUID Search'
    }
  ],

  methods: [
    function render() {
      this
       .addClass(this.myClass())
       .start().addClass('h300').add(this.TITLE).end()
       .start(this.GlobalFuidSearch, {
         placeholder: 'Search...'
       }).addClass(this.myClass('search')).end()
    }
  ]
});
