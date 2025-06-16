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
    ^ {
    }
  `,

  methods: [
    function render() {
      this.
        addClass().
        add(this.data.dynamic(function(color, type, visible, text) {
          if ( visible ) this.start(type).style({color: color}).add(text).end();
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
      title: 'General',
      view: { class: 'foam.core.reflow.ReactiveSectionView' }
    },
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
      class: 'Boolean',
      name: 'visible',
      section: 'general',
      value: true,
      view: { class: 'foam.u2.Switch' }
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
