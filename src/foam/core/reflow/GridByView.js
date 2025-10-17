/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'GridByView',
  extends: 'foam.u2.View',

  documentation: 'Table View for GridBy mLang.',

  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'highlightRowCol',
      value: '$backgroundBrandTertiary'
    },
    {
      class: 'foam.u2.ColorToken',
      name: 'highlightCell',
      value: '$backgroundBrand'
    }
  ],

  css: `
    /* Base table styling */
    ^table {
      border-collapse: collapse;
      border-spacing: 0;
      border: 1px solid $borderDefault;
    }

    /* Row styling */
    ^tr {
      transition: background-color 0.2s ease;
    }

    /* Header row */
    ^tr:first-child {
      background-color: $backgroundDefault;
    }

    /* Cell styling - both TH and TD */
    ^th, ^td {
      padding: .8rem 1rem;
      transition: background-color 0.15s ease;
      vertical-align: middle;
      border: 1px solid $borderDefault;
    }

    /* Header cells */
    ^th {
      background-color: $backgroundDefault;
      font-weight: bold;
      text-align: center;
      text-wrap-mode: nowrap;
      cursor: pointer;
      justify-items: anchor-center;
      align-items: anchor-center;
    }
      
    ^ td:hover {
      font-weight: $font-medium;
      background: $highlightCell;
      color: $highlightCell$foreground;
    }
    
    ^highlighted-col {
      background: $highlightRowCol;
      color: $highlightRowCol$foreground;
    }

    /* Row highlighting */
    ^highlighted-row, ^highlighted-row > th, ^highlighted-row > td {
      background: $highlightRowCol;
      color: $highlightRowCol$foreground;
    }

    ^header-grid {
      display: grid;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
    }
    ^header-grid-row {
      grid-template-rows: 1fr;
      grid-template-columns: 20% 80%;
      text-align: center;
    }
    ^header-grid-col {
      grid-template-rows: 20% 80%;
      grid-template-columns: 1fr;
      text-align: center;
    }

    ^collapse-symbol {
      font-family: monospace;
      justify-self: center;
      align-self: center;
    }
    ^collapsed-header {
      padding: 0.2rem;
    }
    ^collapsed-cell {
      border: 0px solid $borderDefault;
      pointer-events: none;
      padding: 0.2rem;
      opacity: 0.1;
      font-size: 0;
      height: 0;
      padding: 0;
      overflow: hidden;
    }
  `,

  properties: [
    { name: 'x' },
    { name: 'y' },
    { name: 'currentHoverCol' },
    { name: 'currentHoverRow' },
    { name: 'collapsedKeys', factory: () => ({}) }
  ],

  methods: [
    function render(e) {
      var self = this;
      var data = this.data;

      this.addClass();

      var cols = data.cols.sortedKeys();
      this.start('table').
        addClass(this.myClass('table')).
        start('tr').addClass(this.myClass('tr')).
          start('th').addClass(this.myClass('th')).end().
          forEach(cols, function(c) {
            var colKey = `col:${c}`;
            this.start('th')
              .addClass(self.myClass('th'))
              .on('click', () => self.toggleCollapse(c, null))
              .on('mouseover', () => self.currentHoverCol = c)
              .on('mouseleave', function() { self.currentHoverCol = undefined; self.currentHoverRow = undefined; })
              .enableClass(self.myClass('highlighted-col'), self.slot((currentHoverCol) => currentHoverCol === c))
              .enableClass(self.myClass('collapsed-header'), self.slot(collapsedKeys => collapsedKeys[colKey]))
              .start()
                .addClass(self.myClass('header-grid'), self.myClass('header-grid-col'))
                .start()
                  .style({ 'padding': '0 0 2px 0', 'width': 'max-content', 'height': 'max-content'})
                  .addClass(self.myClass('collapse-symbol'))
                  .add(self.slot(collapsedKeys => collapsedKeys[colKey] ? '▿' : '▵'))
                .end()
                .start()
                  .add(self.slot(collapsedKeys => collapsedKeys[colKey] ? '...' : c.toString()))
                .end()
              .end()
            .end();
          }).
        end().
        forEach(data.rows.sortedKeys(), function(r) {
          var rowKey = `row:${r}`;
          var row = data.rows.groups[r];
          this.start('tr')
            .addClass(self.myClass('tr'))
            .on('mouseover', () => self.currentHoverRow = r)
            .on('mouseleave', () => self.currentHoverRow = undefined)
            .enableClass(self.myClass('highlighted-row'), self.slot((currentHoverRow) => currentHoverRow === r))
            .start('th')
              .on('click', () => self.toggleCollapse(null, r))
              .on('mouseover', () => self.currentHoverRow = r)
              .addClass(self.myClass('th'))
              .enableClass(self.myClass('highlighted-col'), self.slot((currentHoverRow) => currentHoverRow === r))
              .enableClass(self.myClass('collapsed-header'), self.slot(collapsedKeys => collapsedKeys[rowKey]))
              .start()
                .addClass(self.myClass('header-grid'), self.myClass('header-grid-row'))
                .start()
                  .style({ 'padding': '0 2px 0 0', 'width': 'max-content', 'height': 'max-content'})
                  .addClass(self.myClass('collapse-symbol'))
                  .add(self.slot(collapsedKeys => collapsedKeys[rowKey] ? '▹' : '◃'))
                .end()
                .start()
                  .add(self.slot(collapsedKeys => collapsedKeys[rowKey] ? '' : r))
                .end()
              .end()
            .end().
            forEach(cols, function(c) {
              const colKey = `col:${c}`;
              const cellVal = row.groups[c]?.value || row.groups[c] || '';
              this.start('td')
                .on('mouseover', function() { self.currentHoverCol = c; self.currentHoverRow = r; })
                .on('mouseleave', function() { self.currentHoverCol = undefined; self.currentHoverRow = undefined; })
                .addClass(self.myClass('td'))
                .enableClass(self.myClass('highlighted-col'), self.slot((currentHoverCol, currentHoverRow) => currentHoverCol === c || currentHoverRow === r))
                .enableClass(self.myClass('collapsed-cell'), self.slot(collapsedKeys => collapsedKeys[colKey] || collapsedKeys[rowKey]))
                .add(self.slot(collapsedKeys => (collapsedKeys[colKey] || collapsedKeys[rowKey]) ? '' : cellVal))
              .end();
            }).
            end();
        });
    },
    function toggleCollapse(colKey, rowKey) {
      const key = colKey ? `col:${colKey}` : `row:${rowKey}`;
      this.collapsedKeys[key] = !this.collapsedKeys[key];
      this.collapsedKeys = { ...this.collapsedKeys };
    },
    function isCollapsed(key) {
      return this.collapsedKeys[key];
    },

    /*
    renderCell: function(x, y, value) {
      var str = value ? (value.toHTML ? value.toHTML() : value) : '';
      if ( value && value.toHTML && value.initHTML ) this.children.push(value);
      return '<td>' + str + '</td>';
    },
    sortAxis: function(values, f) { return values.sort(f.compareProperty); },
    sortCols: function(cols, xFunc) { return this.sortAxis(cols, xFunc); },
    sortRows: function(rows, yFunc) { return this.sortAxis(rows, yFunc); },
    sortedCols: function() {
      return this.sortCols(
        this.cols.groupKeys,
        this.xFunc);
    },
    sortedRows: function() {
      return this.sortRows(
        this.rows.groupKeys,
        this.yFunc);
    },
    toHTML_: function() {
      return this;
    },
    toHTML: function() {
      var out;
      this.children = [];
      var cols = this.cols.groups;
      var rows = this.rows.groups;
      var sortedCols = this.sortedCols();
      var sortedRows = this.sortedRows();

      out = '<table border=0 cellspacing=0 class="gridBy"><tr><th></th>';

      for ( var i = 0 ; i < sortedCols.length ; i++ ) {
        var x = sortedCols[i];
        var str = x.toHTML ? x.toHTML() : x;
        out += '<th>' + str + '</th>';
      }
      out += '</tr>';

      for ( var j = 0 ; j < sortedRows.length ; j++ ) {
        var y = sortedRows[j];
        out += '<tr><th>' + y + '</th>';

        for ( var i = 0 ; i < sortedCols.length ; i++ ) {
          var x = sortedCols[i];
          var value = rows[y].groups[x];
          if ( value ) {
            value.x = x;
            value.y = y;
          }
          out += this.renderCell(x, y, value);
        }

        out += '</tr>';
      }
      out += '</table>';

      return out;
    },

    initHTML: function() {
      for ( var i = 0; i < this.children.length; i++ ) {
        this.children[i].initHTML();
      }
      this.children = [];
    }
  */
  ]
});
