/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'HeaderView',
  extends: 'foam.u2.View',

  css: `
    ^ h1 {
      margin: 12px 0;
    }
    ^ h2 {
      margin: 8px 0;
    }
    ^ h3 {
      margin: 6px 0;
    }
    ^ h4 {
      margin: 4px 0;
    }
  `,

  methods: [
    function render() {
      this.
        addClass().
        add(this.data.dynamic(function(color, type, text) {
          this.start(type).style({color: color}).add(text).end();
        }));
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Header',

  sections: [
    {
      name: 'general',
      title: 'General'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'type',
      section: 'general',
      value: 'h1',
      displayWidth: 10,
      view: { class: 'foam.u2.TextField', choices: [ 'H1', 'H2', 'H3', 'H4', 'B', 'I' ] }
    },
    {
      class: 'String',
      name: 'text',
      section: 'general',
      onKey: true,
      displayWidth: 60
    },
    {
      class: 'Color',
      name: 'color',
      section: 'general',
      value: '#333'
    }
  ],

  methods: [
    function addToE(e) {
      e.tag(foam.core.reflow.HeaderView, {data: this});
    }
  ]
});
