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
  `,

  properties: [
    'of',
    {
      class: 'String',
      name: 'data',
      width: '40',
      placeholder: '*'
    },
    {
      name: 'choice',
      view: function(_, X) { return { class: 'foam.core.reflow.PropertyChoiceView', of: X.data.of } },
      preSet: function(o, n) {
        if ( n == '*' ) {
          this.data = this.data || '';
        } else {
          if ( this.data ) this.data += ',';
          this.data += n;
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
      this.add(function(of) {
        this.tag(self.DATA, { type: 'search' }).add(' ', self.CHOICE);
      });
    }
  ]
});
