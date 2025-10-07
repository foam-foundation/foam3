/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'io.c9.ace',
  name: 'Editor',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.DetailView',
    'foam.u2.tag.TextArea',
    'io.c9.ace.Config'
  ],

  imports: [
    'warn'
  ],

  axioms: [
    // NOTE: when updating this library also update CSP script-src in http CSpec
    // see https://cdnjs.com/libraries/ace/1.9.6 for urls and SRI Hashes
    // ace is internally hard-coded to only load non-min support libs from cdn
    // Also, the non-min ace.js works for both http and https loading.
    foam.u2.JsLib.create({src: 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.9.6/ace.js'})
  ],

  reactions: [
    ['config', 'propertyChange', 'updateEditor'],
    ['', 'propertyChange.data', 'dataToEditor']
  ],

  css:`
    ^ .ace_scroller {
      overscroll-behavior: contain;
    }  `, 

  properties: [
    {
      class: 'Boolean',
      name: 'preventFeedback'
    },
    {
      name: 'container'
    },
    {
      name: 'editor'
    },
    {
      class: 'FObjectProperty',
      of: 'io.c9.ace.Config',
      name: 'config',
      factory: function() {
        return this.Config.create();
      }
    },
    {
      class: 'Boolean',
      name: 'showConfig'
    }
  ],

  methods: [
    function render() {
      this.SUPER(); // required to load ACE JsLib

      var self = this;
      this
        .add(this.slot(function(editor) {
          // Initially render a TextArea while the library loads.
          // If the library fails to load, this will be the fallback.
          return editor ? null : self.TextArea.create({
            data$: self.data$,
            rows: 20, cols: 120,
            css: { 'font-family': 'monospace' }
          });
        }))
        .start()
          .style({
            display: this.editor$.map(e => e ? 'block' : 'none')
          })
          .start('div', null, this.container$)
            .style({
              height: this.config$.dot('height').map(h => foam.Number.isInstance(h) ? h + 'px' : h),
              width:  this.config$.dot('width').map(h =>foam.Number.isInstance(h) ? h + 'px' : h)
            })
          .end()
          .start('span')
            .style({cursor: 'pointer'})
            .add(self.showConfig$.map(b => b ? 'Hide Editor Config' : 'Show Editor Config'))
            .on('click', function() { self.showConfig = ! self.showConfig; })
          .end()
          .add(this.slot(function(showConfig) {
            return this.E().callIf(showConfig, function() {
              this.tag(self.DetailView, { data$: self.config$ });
            });
          }))
        .end();

      this.container.el().then(e => {
        self.renderEditor();
      });
    },

    function fromProperty(p) {
      var storageKey = 'CodeView:' + p.forClass_ + '.' + p.name;
      var config = localStorage[storageKey];
      if ( config ) {
        this.config.copyFrom(foam.json.parseString(config));
      }
      this.config.sub('propertyChange', () => {
        localStorage[storageKey] = foam.json.Compact.stringify(this.config);
      });
    }
  ],

  listeners: [
    function renderEditor() {
      var self = this;
      self.editor = ace.edit(self.container.el_());
      self.editor.session.on('change', self.editorToData);
      self.updateEditor();
      self.dataToEditor();
      self.editor.resize();
    },
    {
      name: 'editorToData',
      isFramed: true,
      code: function() {
        if ( ! this.editor ) return;
        this.preventFeedback = true;
        this.data = this.editor.session.getValue();
        this.preventFeedback = false;
      }
    },
    {
      name: 'dataToEditor',
      code: function() {
        if ( ! this.editor ) return;
        if ( this.preventFeedback ) return;
        this.editor.session.setValue(this.data || '');
      }
    },
    function updateEditor() {
      if ( ! this.editor ) return;
      this.editor.setTheme(this.config.theme.path);
      this.editor.setReadOnly(this.config.isReadOnly);
      this.editor.renderer.setShowGutter(this.config.showGutter);
      this.editor.resize();
      this.editor.session.setMode(this.config.mode.path);
      this.editor.setKeyboardHandler(this.config.keyBinding.path);
    }
  ]
});
