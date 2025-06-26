/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs',
  name: 'FileCitationView',
  extends: 'foam.u2.CitationView',

  css: `
    ^ {
      width: fit-content;
      height: fit-content;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid #ebebeb;
      padding: 1rem;
      margin: 1rem;
    }
    ^top {
      width: fit-content;
      height: fit-content;
    }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.fs.File',
      name: 'data'
    },
  ],

  methods: [
    function render() {
      this
        .addClass()
          .start().addClass(this.myClass('top'))
            .start().add(this.data.IMAGE).end()
          .end();
    }
  ]
});

