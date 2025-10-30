/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyListView',
  extends: 'foam.u2.Controller',

  css: `
    ^ {
      display: inline-flex;
      width: 100%;
      gap: 5px;
    }
    ^ .property-choice {
      width: 100%;
      overflow-x: hidden;
    }
  `,

  properties: [
    'forCls',
    {
      class: 'String',
      name: 'data',
      width: '40',
      onKey: true,
      placeholder: '*'
    },
    {
      name: 'choice',
      view: function(_, X) {
        // X.data is actually 'this' because PropertyListView is a Controller, not a View
        return { class: 'foam.core.reflow.PropertyChoiceView_', forCls: X.data.forCls };
      },
      preSet: function(o, n) {
        if ( n == '*' ) {
          this.data = this.data || '';
        } else if ( n ) {
          if ( this.data ) this.data += ',';
          this.data += n;
          // Schedule clearing the choice after the current execution
          this.clearChoice();
        }
        return n;
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();
      this.addClass();
      this.add(function(forCls) {
        this.tag(self.DATA, { type: 'search' }).add(' ', self.CHOICE);
      });
    }
  ],

  listeners: [
    {
      name: 'clearChoice',
      isFramed: true,
      code: function() {
        this.choice = undefined;
      }
    }
  ]
});
