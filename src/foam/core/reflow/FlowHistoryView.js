/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowHistoryView',
  extends: 'foam.u2.View',

  implements: [ 'foam.u2.util.ClipboardAccess' ],

  documentation: `Renders a Flow's history as a scrollable timeline with
    per-record accordions showing each PropertyUpdate's old -> new diff.`,

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 0;
    }
    ^empty {
      padding: 16px;
      color: $textSecondary;
      text-align: center;
      border: 1px dashed $borderDefault;
      border-radius: 6px;
    }
    ^record {
      border: 1px solid $borderDefault;
      border-radius: 6px;
      background: $backgroundDefault;
      overflow: hidden;
    }
    ^header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      cursor: pointer;
      user-select: none;
    }
    ^header:hover {
      background: $backgroundHover;
    }
    ^headerLeft {
      display: flex;
      gap: 12px;
      align-items: baseline;
    }
    ^timestamp {
      font-weight: $font-medium;
    }
    ^user {
      color: $textSecondary;
      font-size: 12px;
    }
    ^summary {
      color: $textSecondary;
      font-size: 12px;
    }
    ^toggle {
      color: $textSecondary;
      font-size: 14px;
    }
    ^body {
      padding: 0 14px 12px;
      border-top: 1px solid $borderSubtle;
    }
    ^createdLabel {
      padding: 10px 14px;
      color: $success700;
      font-style: italic;
      font-size: 13px;
    }
    ^diffRow {
      display: grid;
      grid-template-columns: 220px 1fr 1fr;
      gap: 12px;
      padding: 10px 0;
      align-items: start;
      border-bottom: 1px solid $borderSubtle;
    }
    ^diffRow:last-child {
      border-bottom: none;
    }
    ^propName {
      font-weight: $font-medium;
      word-break: break-word;
    }
    ^cell {
      position: relative;
    }
    ^oldValue, ^newValue {
      padding: 6px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 220px;
      overflow: auto;
    }
    ^oldValue {
      background: $destructive50;
      color: $destructive700;
    }
    ^newValue {
      background: $success50;
      color: $success700;
    }
    ^copyBtn {
      position: absolute;
      top: 4px;
      right: 4px;
      background: $backgroundDefault;
      border: 1px solid $borderDefault;
      border-radius: 3px;
      padding: 1px 6px;
      font-size: 10px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.12s;
    }
    ^cell:hover ^copyBtn {
      opacity: 1;
    }
    ^count {
      margin-top: 2px;
      font-size: 10px;
      color: $textSecondary;
      text-align: right;
      font-family: monospace;
    }
  `,

  properties: [
    'data'
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      this.addClass();

      if ( ! this.data ) {
        this.start('div').addClass(this.myClass('empty')).add('No history available.').end();
        return;
      }

      this.start('div')
        .select(this.data, function(record) {
          return this.E().call(function() { self.renderRecord(this, record); });
        })
      .end();
    },

    function renderRecord(parent, record) {
      var self     = this;
      var isCreate = ! record.updates || record.updates.length === 0;
      var expanded = foam.lang.SimpleSlot.create({ value: false });

      var rec = parent.start('div').addClass(this.myClass('record'));

      rec.start('div').addClass(this.myClass('header'))
        .on('click', function() { expanded.set(! expanded.get()); })
        .start('div').addClass(this.myClass('headerLeft'))
          .start('span').addClass(this.myClass('timestamp'))
            .add(self.formatTimestamp(record.timestamp))
          .end()
          .start('span').addClass(this.myClass('user'))
            .add(record.user || 'system')
          .end()
        .end()
        .start('span').addClass(this.myClass('summary'))
          .add(self.summaryFor(record))
        .end()
      .end();

      if ( isCreate ) {
        rec.start('div').addClass(this.myClass('createdLabel'))
          .add('Record created.')
        .end();
      } else {
        rec.start('div').addClass(this.myClass('body'))
          .show(expanded)
          .call(function() {
            for ( var i = 0 ; i < record.updates.length ; i++ ) {
              self.renderPropertyUpdate(this, record.updates[i]);
            }
          })
        .end();
      }

      rec.end();
    },

    function renderPropertyUpdate(parent, pu) {
      var self    = this;
      var oldText = this.formatValue(pu.oldValue);
      var newText = this.formatValue(pu.newValue);

      parent.start('div').addClass(this.myClass('diffRow'))
        .start('div').addClass(this.myClass('propName')).add(pu.name).end()
        .start('div').addClass(this.myClass('cell'))
          .start('div').addClass(this.myClass('oldValue')).add(oldText).end()
          .start('button').addClass(this.myClass('copyBtn'))
            .add('Copy')
            .on('click', function(e) { e.stopPropagation(); self.copy(oldText); })
          .end()
          .start('div').addClass(this.myClass('count')).add(this.countSummary(oldText)).end()
        .end()
        .start('div').addClass(this.myClass('cell'))
          .start('div').addClass(this.myClass('newValue')).add(newText).end()
          .start('button').addClass(this.myClass('copyBtn'))
            .add('Copy')
            .on('click', function(e) { e.stopPropagation(); self.copy(newText); })
          .end()
          .start('div').addClass(this.myClass('count')).add(this.countSummary(newText)).end()
        .end()
      .end();
    },

    function countSummary(text) {
      if ( ! text || text === '(empty)' ) return '0 words · 0 chars';
      var words = text.trim().split(/\s+/).filter(Boolean).length;
      var chars = text.length;
      return words + ' words · ' + chars + ' chars';
    },

    function summaryFor(record) {
      if ( ! record.updates || record.updates.length === 0 ) return 'Created';
      var names = record.updates.map(function(u) { return u.name; });
      if ( names.length <= 3 ) return names.join(', ');
      return names.slice(0, 3).join(', ') + ' + ' + (names.length - 3) + ' more';
    },

    function formatTimestamp(ts) {
      if ( ! ts ) return '';
      var d = ts instanceof Date ? ts : new Date(ts);
      return d.toLocaleString();
    },

    function formatValue(v) {
      if ( v == null || v === '' ) return '(empty)';
      if ( typeof v === 'string' ) return v;
      if ( typeof v === 'number' || typeof v === 'boolean' ) return String(v);
      try { return JSON.stringify(v, null, 2); }
      catch (e) { return String(v); }
    }
  ]
});
