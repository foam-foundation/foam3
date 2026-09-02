/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.history',
  name: 'DiffHistoryItemView',
  extends: 'foam.u2.history.HistoryItemView',

  requires: [
    'foam.u2.Accordion',
    'foam.u2.Tab',
    'foam.u2.Tabs',
    'foam.u2.borders.CopyBorder',
    'foam.u2.dialog.StyledModal'
  ],

  documentation: `Renders a history record (anything with timestamp, user and
    a PropertyUpdate[] updates) as an Accordion: the title carries when and
    who, the body one row per updated property with old and new values. A
    multi-line value renders as a line diff with unchanged runs collapsed and
    expands into a modal with Diff, Old and New tabs. Rows are built the first
    time a record is expanded.`,

  constants: [
    {
      name: 'CONTEXT_LINES',
      documentation: 'Unchanged lines kept on each side of a change in a collapsed line diff.',
      value: 2
    },
    {
      name: 'MAX_DIFF_CELLS',
      documentation: 'oldLines * newLines above which a value falls back to side-by-side.',
      value: 4000000
    }
  ],

  messages: [
    { name: 'CREATED',         message: 'Created' },
    { name: 'RECORD_CREATED',  message: 'Record created.' },
    { name: 'SYSTEM_USER',     message: 'system' },
    { name: 'EMPTY_VALUE',     message: '(empty)' },
    { name: 'MORE',            message: 'more' },
    { name: 'WORDS',           message: 'words' },
    { name: 'CHARS',           message: 'chars' },
    { name: 'UNCHANGED_LINES', message: 'unchanged lines' },
    { name: 'EXPAND',          message: 'Expand' },
    { name: 'TAB_DIFF',        message: 'Diff' },
    { name: 'TAB_OLD',         message: 'Old' },
    { name: 'TAB_NEW',         message: 'New' },
    { name: 'OLD_VALUE',       message: 'old value' },
    { name: 'NEW_VALUE',       message: 'new value' }
  ],

  css: `
    ^user, ^summary {
      color: $textSecondary;
      font-size: 12px;
      margin-left: 12px;
    }
    ^body {
      padding: 0 14px 12px;
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
      border-bottom: 1px solid $borderLight;
    }
    ^diffRow:last-child {
      border-bottom: none;
    }
    ^propName {
      font-weight: $font-medium;
      word-break: break-word;
    }
    ^wide {
      grid-column: 2 / span 2;
    }
    /* CopyBorder lays out [content][button] as a centered row; pin the button
       to the block's top-right corner instead. div^copy outranks the border's
       own single-class rules. */
    div^copy {
      display: block;
      position: relative;
    }
    div^copy > span:first-child {
      display: block;
    }
    div^copy > :last-child {
      position: absolute;
      top: 4px;
      right: 4px;
    }
    ^oldValue, ^newValue, ^lines, ^full {
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      overflow: auto;
      margin: 0;
    }
    ^oldValue, ^newValue {
      padding: 6px 8px;
      max-height: 220px;
    }
    ^oldValue {
      background: $destructive50;
      color: $destructive700;
    }
    ^newValue {
      background: $success50;
      color: $success700;
    }
    ^lines, ^full {
      border: 1px solid $borderLight;
      max-height: 320px;
    }
    ^modalTabs ^lines, ^modalTabs ^full {
      max-height: 70vh;
    }
    ^full {
      padding: 6px 8px;
    }
    ^line {
      padding: 0 8px;
    }
    ^lineDel {
      background: $destructive50;
      color: $destructive700;
    }
    ^lineAdd {
      background: $success50;
      color: $success700;
    }
    ^lineCtx {
      color: $textSecondary;
    }
    ^lineSkip {
      color: $textSecondary;
      font-style: italic;
      text-align: center;
      background: $backgroundHover;
    }
    ^count {
      margin-top: 2px;
      font-size: 10px;
      color: $textSecondary;
      text-align: right;
      font-family: monospace;
    }
    ^footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
    }
    ^footerBtn {
      background: $backgroundDefault;
      border: 1px solid $borderDefault;
      border-radius: 3px;
      padding: 1px 6px;
      font-size: 10px;
      cursor: pointer;
    }
  `,

  methods: [
    function outputRecord(parent, record) {
      var self      = this;
      var isCreate  = ! record.updates || record.updates.length === 0;
      var accordion = parent.start(this.Accordion, { expanded: false });

      accordion.title
        .add(record.timestamp)
        .start('span').addClass(this.myClass('user')).add(record.user || this.SYSTEM_USER).end();
      accordion.rightSection
        .start('span').addClass(this.myClass('summary')).add(this.summaryFor(record, isCreate)).end();

      if ( isCreate ) {
        accordion.start('div').addClass(this.myClass('createdLabel')).add(this.RECORD_CREATED).end();
      } else {
        // Rows, and their line diffs, are built on the first expand only.
        var built = false;
        accordion.onDetach(accordion.expanded$.sub(function() {
          if ( built || ! accordion.expanded ) return;
          built = true;
          accordion.start('div').addClass(self.myClass('body'))
            .call(function() {
              record.updates.forEach(function(pu) { self.renderPropertyUpdate(this, pu); }, this);
            })
          .end();
        }));
      }

      accordion.end();
    },

    function renderPropertyUpdate(parent, pu) {
      var self    = this;
      var oldText = this.formatValue(pu.oldValue);
      var newText = this.formatValue(pu.newValue);
      var lines   = this.isMultiLine(oldText) || this.isMultiLine(newText) ?
        foam.util.TextDiff.lineDiff(oldText, newText, this.MAX_DIFF_CELLS) : null;

      var row = parent.start('div').addClass(this.myClass('diffRow'))
        .start('div').addClass(this.myClass('propName')).add(pu.name).end();

      if ( lines ) {
        row.start('div').addClass(this.myClass('wide'))
          .call(function() { self.renderLineDiff(this, lines, self.CONTEXT_LINES); })
          .start('div').addClass(this.myClass('footer'))
            .start('span').addClass(this.myClass('count'))
              .add(self.countSummary(oldText) + ' → ' + self.countSummary(newText))
            .end()
            .start('button').addClass(this.myClass('footerBtn')).add(self.EXPAND)
              .on('click', function(e) { e.stopPropagation(); self.openDiffModal(pu.name, oldText, newText, lines); })
            .end()
          .end()
        .end();
      } else {
        this.renderValue(row, 'oldValue', oldText, this.OLD_VALUE);
        this.renderValue(row, 'newValue', newText, this.NEW_VALUE);
      }

      row.end();
    },

    function renderValue(parent, valueClass, text, label) {
      parent.start('div')
        .start(this.CopyBorder, { copyText: text, label: label }).addClass(this.myClass('copy'))
          .start('div').addClass(this.myClass(valueClass)).add(text).end()
        .end()
        .start('div').addClass(this.myClass('count')).add(this.countSummary(text)).end()
      .end();
    },

    function renderLineDiff(parent, lines, context) {
      /* context = unchanged lines kept around each change; Infinity keeps them all. */
      var box = parent.start('div').addClass(this.myClass('lines'));

      var i = 0;
      while ( i < lines.length ) {
        if ( lines[i].type !== ' ' ) {
          this.renderLine(box, lines[i]);
          i++;
          continue;
        }

        var j = i;
        while ( j < lines.length && lines[j].type === ' ' ) j++;
        var run  = j - i;
        var head = i === 0 ? 0 : context;
        var tail = j === lines.length ? 0 : context;

        if ( ! isFinite(context) || run <= head + tail + 1 ) {
          for ( var k = i ; k < j ; k++ ) this.renderLine(box, lines[k]);
        } else {
          for ( var k = i ; k < i + head ; k++ ) this.renderLine(box, lines[k]);
          box.start('div').addClass(this.myClass('line')).addClass(this.myClass('lineSkip'))
            .add('… ' + (run - head - tail) + ' ' + this.UNCHANGED_LINES + ' …')
          .end();
          for ( var k = j - tail ; k < j ; k++ ) this.renderLine(box, lines[k]);
        }
        i = j;
      }

      box.end();
    },

    function renderLine(parent, line) {
      var cls = line.type === '-' ? 'lineDel' : line.type === '+' ? 'lineAdd' : 'lineCtx';
      parent.start('div').addClass(this.myClass('line')).addClass(this.myClass(cls))
        .add(line.type + ' ' + line.text)
      .end();
    },

    function openDiffModal(name, oldText, newText, lines) {
      var self  = this;
      var modal = this.StyledModal.create({ title: name, maxWidth: '90vw', maxHeight: '90vh' }, this);

      modal.start(this.Tabs).addClass(this.myClass('modalTabs'))
        .start(this.Tab, { label: this.TAB_DIFF, selected: true })
          .call(function() { self.renderLineDiff(this, lines, Infinity); })
        .end()
        .start(this.Tab, { label: this.TAB_OLD })
          .call(function() { self.renderFull(this, oldText, self.OLD_VALUE); })
        .end()
        .start(this.Tab, { label: this.TAB_NEW })
          .call(function() { self.renderFull(this, newText, self.NEW_VALUE); })
        .end()
      .end();

      modal.open();
    },

    function renderFull(parent, text, label) {
      parent.start(this.CopyBorder, { copyText: text, label: label }).addClass(this.myClass('copy'))
        .start('pre').addClass(this.myClass('full')).add(text).end()
      .end();
    },

    function isMultiLine(text) {
      return text.indexOf('\n') !== -1;
    },

    function countSummary(text) {
      if ( text === this.EMPTY_VALUE ) return '0 ' + this.WORDS + ' · 0 ' + this.CHARS;
      var words = text.trim().split(/\s+/).filter(Boolean).length;
      return words + ' ' + this.WORDS + ' · ' + text.length + ' ' + this.CHARS;
    },

    function summaryFor(record, isCreate) {
      if ( isCreate ) return this.CREATED;
      var names = record.updates.map(function(u) { return u.name; });
      if ( names.length <= 3 ) return names.join(', ');
      return names.slice(0, 3).join(', ') + ' + ' + (names.length - 3) + ' ' + this.MORE;
    },

    function formatValue(v) {
      if ( v == null || v === '' ) return this.EMPTY_VALUE;
      return foam.String.isInstance(v) ? v : foam.json.Pretty.stringify(v);
    }
  ]
});
