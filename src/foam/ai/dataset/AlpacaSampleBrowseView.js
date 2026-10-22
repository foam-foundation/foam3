// cspell:ignore Consolas mlang dpct
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.dataset',
  name: 'AlpacaSampleBrowseView',
  extends: 'foam.u2.View',

  documentation: `
    Bulk review for AlpacaSample training records.
    Displays instruction/input/output columns with inline editing via
    AlpacaSampleRowView; shows a filtered count and unfiltered total if 
    DAOControllerConfig.unfilteredDAO is provided in the context.

    Wire as the summaryView of a DAOControllerConfig, e.g. in menus.jrl:

    p({
      "class": "foam.core.menu.Menu",
      ...
      "handler": {
        "class": "foam.core.menu.DAOMenu2",
        "config": {
          "class": "foam.comics.v2.DAOControllerConfig",
          "daoKey": "datasetDAO",
          "summaryView": { "class": "foam.ai.dataset.AlpacaSampleBrowseView" }
        }
      }
    })
  `,

  requires: [
    'foam.mlang.sink.Count',
    'foam.u2.view.LazyScrollManager'
  ],

  imports: ['config?'],

  // Makes this.data (the predicatedDAO) available to AlpacaSampleRowView
  // instances as `sampleDAO` so they can put/remove without prop drilling.
  // Exports colWidths_ so row views stay in sync with header resizing.
  exports: ['data as sampleDAO', 'colWidths_ as colWidths'],

  cssTokens: [
    [ 'fontSemiBold', '600' ]
  ],

  css: `
    << {
      display: flex;
      flex-direction: column;
      padding: 16px;
      box-sizing: border-box;
      height: 100%;
      min-height: 0;
    }
    <<header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0 10px 0;
      font-size: 13px;
      color: $textSecondary;
      flex-shrink: 0;
    }
    <<goto {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    <<goto input {
      width: 64px;
      padding: 4px 8px;
      border: 1px solid $borderLight;
      border-radius: 3px;
      font-size: 13px;
    }
    <<scroll-container {
      flex: 1;
      min-height: 200px;
      max-height: calc(100vh - 260px);
      overflow-y: auto;
      border: 1px solid $borderLight;
      border-radius: 3px;
    }
    <<col-header {
      display: grid;
      background: $backgroundSecondary;
      font-weight: $fontSemiBold;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      white-space: nowrap;
      border-bottom: 2px solid $borderLight;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    <<col-header > * {
      position: relative;
      padding: 8px;
      border-right: 1px solid $borderLight;
      overflow: visible;
    }
    <<col-header > *:last-child { border-right: none; }
    <<col-num { text-align: right; }
    <<resize-handle {
      position: absolute;
      right: -4px;
      top: 0;
      width: 8px;
      height: 100%;
      cursor: col-resize;
      z-index: 2;
    }
    <<resize-handle:hover { background: $borderDefault; opacity: 0.5; }
  `,

  properties: [
    { class: 'Int',    name: 'total',     value: 0 },
    { class: 'Int',    name: 'totalAll',  value: 0 },
    { class: 'String', name: 'colWidths_', value: '4% 27% 19% 42% 8%' },
    {
      class: 'Int',
      name:  'gotoRow',
      label: '',
      min:   1,
      onKey: false,
      postSet: function() { this.go(); }
    },
    { name: 'lsm_', documentation: 'LazyScrollManager instance — used for scrollToIndex.' }
  ],

  actions: [
    {
      name:      'go',
      isEnabled: function(gotoRow) { return gotoRow >= 1; },
      code: function() {
        if ( this.lsm_ ) this.lsm_.scrollToIndex = this.gotoRow;
      }
    }
  ],

  methods: [
    function startDrag_(e, colIdx) {
      var self        = this;
      var startX      = e.clientX;
      var startWidths = this.colWidths_.trim().split(/\s+/).map(function(w) { return parseFloat(w); });
      // Use the col-header element width as the 100% reference.
      var containerW  = e.currentTarget.parentElement.parentElement.offsetWidth;

      function onMove(ev) {
        var dpct  = (ev.clientX - startX) / containerW * 100;
        // Clamp so neither resized column drops below 3%.
        var delta = Math.max(3 - startWidths[colIdx], Math.min(startWidths[colIdx + 1] - 3, dpct));
        var ws    = startWidths.slice();
        ws[colIdx]     += delta;
        ws[colIdx + 1] -= delta;
        self.colWidths_ = ws.map(function(w) { return w.toFixed(2) + '%'; }).join(' ');
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
      }

      document.body.style.cursor     = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
      e.preventDefault();
    },

    function render() {
      var self = this;

      this.refreshCount_();
      this.data.listen(this.refreshCount_);

      // ── Scroll container ────────────────────────────────────────
      var scrollContainer = this.E('div').addClass(this.myClass('scroll-container'));

      scrollContainer
        // Sticky column header — grid-template-columns is bound to colWidths_$
        // so it stays in sync with row views as the user drags resize handles.
        .start('div').addClass(this.myClass('col-header'))
          .style({ 'grid-template-columns': self.colWidths_$ })
          .start('div').addClass(this.myClass('col-num')).add('#')
            .start('div').addClass(this.myClass('resize-handle'))
              .on('mousedown', function(e) { self.startDrag_(e, 0); })
            .end()
          .end()
          .start('div').add('Instruction')
            .start('div').addClass(this.myClass('resize-handle'))
              .on('mousedown', function(e) { self.startDrag_(e, 1); })
            .end()
          .end()
          .start('div').add('Input')
            .start('div').addClass(this.myClass('resize-handle'))
              .on('mousedown', function(e) { self.startDrag_(e, 2); })
            .end()
          .end()
          .start('div').add('Output')
            .start('div').addClass(this.myClass('resize-handle'))
              .on('mousedown', function(e) { self.startDrag_(e, 3); })
            .end()
          .end()
          .start('div').add('Actions').end()
        .end()
        .tag(this.LazyScrollManager, {
          data$:       this.data$,
          rootElement: scrollContainer,
          rowView:     { class: 'foam.ai.dataset.AlpacaSampleRowView' }
        }, this.lsm_$);

      this.addClass()
        .start('div').addClass(this.myClass('header'))
          .start('span')
            .add(this.slot(function(total, totalAll) { return total ? 'Total: ' + total + ' of ' + totalAll : ''; }))
          .end()
          .start('div').addClass(this.myClass('goto'))
            .add('Go to row')
            .startContext({ data: self })
              .add(self.GOTO_ROW)
            .endContext()
          .end()
        .end()
        .add(scrollContainer);
    },

  ],

  listeners: [
    function refreshCount_() {
      var self = this;
      this.data.select(this.Count.create()).then(function(s) { self.total = s.value; });
      if ( this.config && this.config.unfilteredDAO ) {
        this.config.unfilteredDAO.select(this.Count.create()).then(function(s) { self.totalAll = s.value; });
      }
    }
  ]
});
