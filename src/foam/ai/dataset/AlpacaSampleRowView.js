// cspell:ignore Consolas mlang
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.dataset',
  name: 'AlpacaSampleRowView',
  extends: 'foam.u2.View',

  imports: ['sampleDAO', 'colWidths?'],

  css: `
    << {
      display: grid;
      grid-template-columns: 4% 27% 19% 42% 8%;
      border-bottom: 1px solid $borderLight;
      min-width: 0;
    }
    << > * {
      padding: 6px 8px;
      border-right: 1px solid $borderLight;
      min-width: 0;
      overflow: hidden;
    }
    << > *:last-child { border-right: none; }
    <<num {
      text-align: right;
      color: $textTertiary;
      font-size: 11px;
      padding-top: 10px;
    }
    <<textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid transparent;
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      resize: vertical;
      padding: 4px;
      background: transparent;
    }
    <<textarea:focus { border-color: $borderDefault; background: $backgroundDefault; outline: none; }
    <<source { font-size: 10px; color: $textTertiary; margin-top: 4px; word-break: break-all; }
    <<actions { display: flex; flex-direction: column; gap: 4px; }
  `,

  properties: [
    { class: 'Int',     name: 'rowNum', value: 0     },
    { class: 'Boolean', name: 'dirty_', value: false  },
    { name: 'clone_', documentation: 'Mutable working copy of data.', factory: function() { return this.data.clone(); } }
  ],

  actions: [
    {
      name:      'saveSample',
      label:     'Save',
      isEnabled: function(dirty_) { return dirty_; },
      code: function(X) {
        var self = this;
        X.sampleDAO.put(this.clone_).then(function() { self.dirty_ = false; });
      }
    },
    {
      name:      'resetSample',
      label:     'Reset',
      isEnabled: function(dirty_) { return dirty_; },
      code: function() {
        this.clone_.copyFrom(this.data);
        this.dirty_ = false;
      }
    },
    {
      name:  'deleteSample',
      label: 'Delete',
      code: function(X) { X.sampleDAO.remove(this.data); }
    }
  ],

  methods: [
    function render() {
      var self  = this;
      var clone = this.clone_;

      self.onDetach(clone.sub(function() { self.dirty_ = true; }));

      this.addClass()
        .style({ 'grid-template-columns': self.slot(function(colWidths) { return colWidths || '4% 27% 19% 42% 8%'; }) })
        .start('div').addClass(this.myClass('num'))
          .add(this.rowNum$)
        .end()
        .start('div')
          .start({class: 'foam.u2.tag.TextArea', data$: clone.instruction$, rows: 6, onKey: true, escapeTextArea: false})
            .addClass(this.myClass('textarea'))
          .end()
        .end()
        .start('div')
          .start({class: 'foam.u2.tag.TextArea', data$: clone.input$, rows: 6, onKey: true})
            .addClass(this.myClass('textarea'))
          .end()
        .end()
        .start('div')
          .start({class: 'foam.u2.tag.TextArea', data$: clone.output$, rows: 6, onKey: true})
            .addClass(this.myClass('textarea'))
          .end()
          .start('div').addClass(this.myClass('source'))
            .add(this.data.language + ' · ' + this.data.sourceFile)
          .end()
        .end()
        .start('div').addClass(this.myClass('actions'))
          // Pass the row view as context data so isEnabled(dirty_) reads
          // this view's dirty_ property reactively.
          .startContext({ data: self })
            .add(self.SAVE_SAMPLE)
            .add(self.RESET_SAMPLE)
            .add(self.DELETE_SAMPLE)
          .endContext()
        .end(); 

      // LazyScrollManager sets data-idx on our root element after render.
      // Read it once the element is in the DOM.
      this.el().then(function(el) {
        var idx = parseInt(el.getAttribute('data-idx'));
        if ( ! isNaN(idx) ) self.rowNum = idx;
      });
    }
  ]
});
