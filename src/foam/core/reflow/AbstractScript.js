/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AbstractScript',

  documentation: `
    An editable block of code with an output area, a run action and an
    autoRun switch that runs the code when the flow loads. Subclasses supply
    run_(), which decides where and how the code runs.
  `,

  static: [
    function codeView(mode) {
      // Code editor for the code property, highlighted in the given Ace mode,
      // e.g. 'JAVASCRIPT', 'SH' or 'JAVA', with a plain text fallback.
      return {
        class: 'foam.u2.view.ObjAltView',
        views: [
          [ {class: 'foam.u2.view.CodeView', config: { width: '100%', mode: mode, showGutter: false }}, 'Code'],
          [ {class: 'foam.u2.tag.TextArea', rows: 16 }, 'Plain Text']
        ]
      };
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'code',
      reactive: false,
      view: function() { return foam.core.reflow.AbstractScript.codeView('JAVASCRIPT'); },
      displayWidth: 60
    },
    {
      class: 'String',
      name: 'output',
      transient: true,
      reactive: false,
      view: { class: 'foam.u2.tag.TextArea', rows: 8 },
      displayWidth: 60
    },
    { class: 'Boolean', name: 'autoRun', view: { class: 'foam.u2.Switch' } }
  ],

  methods: [
    function onLoad() {
      if ( this.autoRun ) return this.run_();
    },

    function run_() {
      throw new Error(this.cls_.id + ' does not implement run_()');
    }
  ],

  actions: [
    // The run action delegates to run_() so that subclasses can capture the
    // result by overriding run_() and calling this.SUPER(), which actions don't support.
    function run() {
      return this.run_();
    },

    function clearOutput() {
      this.output = '';
    }
  ]
});
