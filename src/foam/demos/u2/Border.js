/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Several examples of creating Border or Container views.
// Containers are views which set the 'content' Property of Element to
// some child Element. When add() is called new child elements are added
// to the content area rather than to the end of the View.
// Alternatively, containers can create explicit content areas like
// 'leftPane', 'rightPane', 'header', etc.

// Note that this is just a simple Tab view for demonstration purposes.
// There's a more complete implementation in the foam.u2 package.
foam.CLASS({
  name: 'Tab',
  extends: 'foam.u2.Element',

  css: `
    << { xxxposition: absolute; }
  `,

  properties: [
    { class: 'String',  name: 'label' },
    { class: 'Boolean', name: 'selected' }
  ],

  methods: [
    function render() {
      this.addClass();
    }
  ]
});


foam.CLASS({
  name: 'Tabs',
  extends: 'foam.u2.Element',

  css: `
    << {
      display: block;
      width: 98%;
    }
    <<tabRow { height: 40px; }
    <<tab {
      background: $backgroundTertiary;
      border: 1px solid $borderStrong;
      border-radius: 3px 3px 0 0;
      display: inline-block;
      height: 14px;
      padding: 8px;
    }
    <<tab.selected {
      background:$backgroundDefault;
      border-bottom: 1px solid $backgroundDefault;
      position: relative;
      z-index: 1;
    }
    <<bottomEdge {
      background:$backgroundDefault;
      height: 2.5px;
      left: 0;
      position: absolute;
      top: 27px;
      width: 100%;
    }
    <<content {
      background:$backgroundDefault;
      border: 1px solid $borderStrong;
      left: -4px;
      margin: 4px;
      padding: 6px;
      position: relative;
      top: -13px;
    }
  `,

  properties: [
    {
      class: 'Array',
      name: 'tabs'
    },
    {
      name: 'selected',
      postSet: function(o, n) {
        if ( o ) o.selected = false;
        n.selected = true;
      }
    },
    'tabRow'
  ],

  methods: [
    function init() {
      this.
        addClass(this.myClass()).
        start('div', null, this.tabRow$).
          addClass(this.myClass('tabRow')).
        end().
        start('div', null, this.content$).
          addClass(this.myClass('content')).
        end();
    },

    function add(tab) {
      if ( Tab.isInstance(tab) ) {

        this.tabs.push(tab);

        if ( ! this.selected ) this.selected = tab;

        this.tabRow.start('span').
          show(tab.shown$).
          addClass(this.myClass('tab')).
          enableClass('selected', tab.selected$).
          on('click', function() { this.selected = tab; }.bind(this)).
          add(tab.label).
          br().
          start('div').addClass(this.myClass('bottomEdge')).show(tab.selected$).end().
        end();

        tab.shown$.sub(() => {
          if ( ! tab.shown && tab.selected ) {
            for ( var i = 0 ; i < this.tabs.length ; i++ ) {
              var t = this.tabs[i];
              if ( t.shown ) this.selected = t;
              return;
            }
          }
        });

        // tab.shown$ = tab.selected$;
        // Rather than using 'shown', setting visibility maintains the size of the
        // largest tab.
        tab.style({display: tab.selected$.map(function(s) { return s ? '' : 'none'; })});
      }

      return this.SUPER.apply(this, arguments);
    }
  ]
});


// TODO: add CardDeck example
foam.CLASS({
  name: 'Card',
  extends: 'foam.u2.Element',

  css: `
    << {
      background:$backgroundDefault;
      border-radius: 3px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.38);
      margin: 8px;
      transform-origin: top left;
      display: inline-block;
    }
    <<content { padding: 6px; width: 300px; height: 200px; background:$backgroundDefault; }
  `,

  methods: [
    function init() {
      this.
        addClass(this.myClass()).
        start('div', null, this.content$).
          addClass(this.myClass('content')).
        end();
    }
  ]
});




foam.CLASS({
  name: 'SampleBorder',
  extends: 'foam.u2.Element',

  css: `
    << { background: gray; padding: 10px; display: inline-block; }
    <<title { padding: 6px; align-content: center; background: aliceblue; }
    <<footer { padding: 6px; align-content: left; background:$backgroundDefault; }
    <<content { padding: 6px; width: 300px; height: 200px; background:$backgroundDefault; }
  `,

  properties: [
    'title',
    'footer'
  ],

  methods: [
    function init() {
      this.
        start().
          addClass(this.myClass()).
          start('div').addClass(this.myClass('title')).add(this.title$).end().
          start('div', null, this.content$).
            addClass(this.myClass('content')).
          end().
          start('div')
            .addClass(this.myClass('footer'))
            .tag('hr')
            .add(this.footer$)
          .end().
        end();
    }
  ]
});



foam.CLASS({
  name: 'LabelledSection',
  extends: 'foam.u2.Element',

  css: `
    << {
      display: block;
      padding: 10px 4px;
    }
    <<title {
      background:$backgroundDefault;
      color: #666;
      display: inline;
      font-size: larger;
      padding: 0 4px;
      position: relative;
      top: -20px;
    }
    <<content {
      // height: 200px;
      position: relative;
      // top: -22px;
      // width: 300px;
    }
  `,

  properties: [ 'title' ],

  methods: [
    function init() {
      this.start().
        addClass(this.myClass()).
        start('div').addClass(this.myClass('title')).add(this.title$).end().
        start('div', null, this.content$).
          addClass(this.myClass('content')).
        end().
      end();
    }
  ]
});


foam.CLASS({
  name: 'SideLabelledSection',
  extends: 'foam.u2.Element',

  css: `
    << {
      display: inline-block;
      padding: 10px;
    }
    <<title {
      background:$backgroundDefault;
      color: #666;
      display: inline;
      padding: 3px;
      vertical-align: top;
      width: 33%;
    }
    <<content {
      background:$backgroundDefault;
      display: inline-block;
      height: 200px;
      width: 66%;
    }
  `,

  properties: [ 'title' ],

  methods: [
    function init() {
      this.start().
        addClass(this.myClass()).
        start('div').addClass(this.myClass('title')).add(this.title).end().
        start('div', null, this.content$).
          addClass(this.myClass('content')).
        end().
      end();
    }
  ]
});


foam.CLASS({
  name: 'FoldingSection',
  extends: 'foam.u2.Element',

  requires: [ 'foam.u2.ActionView' ],

  css: `
    << {
      width: 98%;
      border-top: 1px solid #999;
      display: inline-block;
      padding: 10px 4px;
    }
    <<.expanded {
      border: 1px solid #999;
     // padding-left: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.38);
    }
    <<control {
      background:$backgroundDefault;
      display: inline;
      float: right;
      height: 30px;
      position: relative;
      top: -10px;
      width: 30px;
    }
    <<toolbar {
      color: #666;
      display: inline-block;
      padding: 3px;
      position: relative;
      left: -8px;
      top: -20px;
      width: 100%;
    }
    <<title {
      background:$backgroundDefault;
      left: 6px;
      padding: 3px;
      position: relative;
      top: -3px;
    }
    <<content {
      background:$backgroundDefault;
      display: initial;
     //  height: 200px;
      position: relative;
      top: -22px;
      width: 300px;
    }
    << .foam-u2-ActionView-toggle {
      transform: rotate(-90deg);
      transition: transform 0.3s;
      background: transparent;
      border: none;
      outline: none;
      padding: 3px;
      width: 30px;
      height: 30px;
    }
    <<.expanded .foam-u2-ActionView-toggle {
      transform: rotate(0deg);
      transition: transform 0.3s;
    }
    << .foam-u2-ActionView-toggle:hover {
      background: transparent;
    }
  `,

  properties: [
    'title',
    {
      class: 'Boolean',
      name: 'expanded',
      value: true
    }
  ],

  methods: [
    function init() {
      this.
        addClass(this.myClass()).
        enableClass('expanded', this.expanded$).
        start('div').
          addClass(this.myClass('toolbar')).
          start('span').
            addClass(this.myClass('title')).
            add(this.title$).
          end().
          start('div').
            addClass(this.myClass('control')).
            tag(this.ActionView, {action: this.TOGGLE, data: this, label: '\u25BD'}).
          end().
        end().
        start('div', null, this.content$).
          show(this.expanded$).
          addClass(this.myClass('content')).
        end();
    }
  ],

  actions: [
    function toggle() { this.expanded = ! this.expanded; }
  ]
});



foam.CLASS({
  name: 'MDFoldingSection',
  extends: 'FoldingSection',

  requires: [ 'foam.u2.ActionView' ],

  css: `
    << {
      border: 1px solid #999;
      padding-left: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.38);
    }
    <<.expanded {
    }
    <<control {
      background:$backgroundDefault;
      display: inline;
      float: right;
      height: 30px;
      position: relative;
      top: -10px;
      width: 30px;
    }
    <<toolbar {
      color: #666;
      display: inline-block;
      padding: 3px;
      position: relative;
      left: -8px;
      top: 10px;
      width: 100%;
    }
    <<title {
      background: $backgroundDefault;
      padding: 3px;
      position: relative;
      top: -2px;
    }
    <<content {
      background: $backgroundDefault;
      height: 200px;
      width: 300px;
    }
    << .foam-u2-ActionView-toggle {
      transform: rotate(-90deg);
      transition: transform 0.3s;
      background: transparent;
      border: none;
      outline: none;
      padding: 3px;
      width: 30px;
      height: 30px;
    }
    <<.expanded .foam-u2-ActionView-toggle {
      transform: rotate(0deg);
      transition: transform 0.3s;
    }
    << .foam-u2-ActionView-toggle:hover {
      background: transparent;
    }
  `,
/*
  properties: [
    'title',
    {
      class: 'Boolean',
      name: 'expanded',
      value: true
    }
  ],

  methods: [
    function init() {
      this.
        addClass(this.myClass()).
        enableClass('expanded', this.expanded$).
        start('div').
          addClass(this.myClass('toolbar')).
          start('span').
            addClass(this.myClass('title')).
            add(this.title$).
          end().
          start('div').
            addClass(this.myClass('control')).
            tag(this.ActionView, {action: this.TOGGLE, data: this, label: '\u25BD'}).
          end().
        end().
        start('div', null, this.content$).
          show(this.expanded$).
          addClass(this.myClass('content')).
        end();
    }
  ],

  actions: [
    function toggle() { this.expanded = ! this.expanded; console.log(this.expanded); }
  ]
  */
});


foam.CLASS({
  name: 'SampleSplitContainer',
  extends: 'foam.u2.Element',

  css: `
    << { background: gray; padding: 10px; display: inline-flex; }
    <<content { margin: 4px; padding: 6px; width: 300px; height: 200px; background: $backgroundDefault; }
  `,

  properties: [
    'leftPanel', 'rightPanel'
  ],

  methods: [
    function init() {
      this.
        addClass(this.myClass()).
        start('div', null, this.leftPanel$).
          addClass(this.myClass('content')).
        end().
        start('div', null, this.rightPanel$).
          addClass(this.myClass('content')).
        end();
    }
  ]
});



foam.CLASS({
  name: 'Blink',
  extends: 'foam.u2.Element',

  methods: [ function init() { this.blinkOn(); } ],

  listeners: [
    {
      name: 'blinkOn',
      isMerged: true,
      mergeDelay: 250,
      code: function() { this.style({visibility: 'visible'}); this.blinkOff(); }
    },
    {
      name: 'blinkOff',
      isMerged: true,
      mergeDelay: 750,
      code: function() { this.style({visibility: 'hidden'}); this.blinkOn(); }
    }
  ]
});

foam.CLASS({
  name: 'Columns',
  extends: 'foam.u2.Element',

  css: `
    << {
      display: flex;
    }
  `,

  methods: [
    function init() {
      this.addClass();
    }
  ]
});

foam.CLASS({
  name: 'Column',
  extends: 'foam.u2.Element',

  css: `
    << {
      display: inline-block;
      padding-right: 8px;
      // padding: 4px;
      float: left;
      // margin: 4px;
      // border: 1px solid black;
      // width: 100%;
    }
  `,

  methods: [
    function init() {
      this.addClass()
    }
  ]
});


foam.CLASS({
  name: 'Row',
  extends: 'foam.u2.Element',

  css: `
    << {
      display: flex;
    }
  `,

  methods: [
    function init() {
      this.addClass();
    },
    function add() {
      for ( var i = 0 ; i < arguments.length ; i++ ) {
        var c = this.createChild_(Column);
        this.add_(c);
        c.add(arguments[i]);
      }
      return this;
    }
  ]
});
