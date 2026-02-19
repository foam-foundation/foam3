/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PivotTableView',
  extends: 'foam.u2.View',

  documentation: 'Table View for Pivot',

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
    ^tableWrapper {
      width: 100%;
      overflow: auto;
      position: relative;
      border: 1px solid $borderStrong;
      max-height: 80vh;
    }
    /* Base table styling */
    ^table {
      // Needed as otherwise there is jitter during scrolling with sticky rows 
      border-collapse: separate;
      border-spacing: 0;
    }

    /* Row styling */
    ^tr {
      transition: background-color 0.2s ease;
    }

    /* Cell styling - both TH and TD */
    ^th, ^td {
      text-align: center;
      padding: .8rem 1rem;
      transition: background-color 0.15s ease;
      box-shadow: inset -1px -1px 0 $borderLight;
    }

    /* Header cells */
    ^th {
      background-color: $backgroundDefault;
      font-weight: bold;
      text-wrap-mode: nowrap;
    }
      
    ^td:hover {
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

    ^sticky-headers th {
      position: sticky;
      z-index: 1;
    }

    ^sticky-headers tr[data-type="header-row"] th {
      position: sticky;
      z-index: 2;
    }

    ^sticky-headers tr:first-child th:first-child {
      z-index: 100; 
    }
  `,

  properties: [
    { name: 'currentHoverCol' },
    { name: 'currentHoverRow' },
    { name: 'colIndexMap', documentation: 'flattened list of cols' },
    { class: 'Boolean', name: 'renderComplete' },
    { class: 'Array', name: 'rowHeightCache' },
    { class: 'Array', name: 'colWidthCache' },
    'table'
  ],

  methods: [
    function render() {
      this.colIndexMap = [];
      var rowDepth = this.data.yFunc.length;
      var colDepth = this.data.xFunc.length;
      // get rows/cols as simple nested dictionary instead of groupbys
      var rowsDict = this.makeDictionary(this.data.rows);
      // get cols from rows only returns the cols which actually have corresponding row data instead of using data cols
      var colsDict = colDepth > 0 ? this.getColsFromRows(this.data.rows, 0, {}, rowDepth, this.data.cols) : null;
      this
        .addClass(this.myClass('tableWrapper'))
        .enableClass(this.myClass('sticky-headers'), this.data$.dot('stickyHeaders'))
        .resizeObserver(() => {
          this.clearProperty('rowHeightCache');
          this.clearProperty('colWidthCache');
          this.applyOffsets();
        });
      var table = this.start('table', {}, this.table$).addClass(this.myClass('table'));
      this.renderColHeaders(table, colsDict, [], 0, rowDepth, colDepth);
      if ( ! this.data.rows ) 
        this.renderColVals(table, colsDict, colDepth);
      else
        this.renderRows(table, rowsDict, 0, rowDepth, colDepth);
      table.end();
      this.renderComplete = true;
      this.applyOffsets();
    },

    /**
     * renders nested column recursively, each time returning the total number of child headers
     * for each column header to be used as the colspan
     * @param {*} cols - nested map of column headers
     * @param {*} rows - array of table rows, initial value = []
     * @param {*} keyPrefix - used for cell highlighting
     * @returns 
     */
    function renderColHeaders(table, cols, rows, depth, rowDepth, colDepth, keyPrefix) {
      if ( ! cols ) return;
      if ( ! keyPrefix ) keyPrefix = '';
      var row;
      if ( rows.length < depth + 1 ) {
        row = table.start('tr').addClass(this.myClass('tr')).attrs({'data-type': 'header-row'});
        if ( depth == 0 && rowDepth && colDepth ) row
          .start('th')
            .addClass(this.myClass('th'))
            .attrs({ 'colspan' : rowDepth, 'rowspan' : colDepth, 'data-type': 'headers', 'data-vcol': 0, 'data-vrow': 0 })
            .add('')
          .end();
        rows.push(row);
      }
      row = rows[depth];
      var keys = Object.keys(cols).sort();
      var hasChildren = keys.some(c => cols[c] instanceof Object && Object.keys(cols[c]).length);
      var colSpans = [];
      if ( hasChildren ) {
        keys.forEach(c => {
          var childKeysSpan = 
            this.renderColHeaders(table, cols[c], rows, depth + 1, rowDepth, colDepth, keyPrefix + c);
          colSpans.push(childKeysSpan);
        });
      }
      let vCol = rowDepth + 0;
      for ( var i = 0; i < keys.length; i++ ) {
        var colSpan = hasChildren ? colSpans[i] : 1;
        const key = keyPrefix + keys[i];
        this.renderCell(rows[depth], 'th', { 'colspan' : colSpan, 'data-type': 'headers', 'data-vcol': vCol, 'data-vrow': depth }, keys[i], key, null);
        vCol = vCol + colSpan;
        if ( depth == colDepth - 1 ) this.colIndexMap.push(key);
      }
      if ( depth === 0 ) rows.forEach(r => r.end());
      return hasChildren ? 
        colSpans.reduce((x,y) => x + y, 0) :
        keys.length;
    },

    /**
     * renders nested rows recursively
     * @param {*} rows - nested map of row headers and row values
     * @param {*} prefix - used for cell highlighting
     * @returns an object containing the first of a group of child row headers (ret.row) as well
     * as the number of total child row headers (ret.rowspan), used to insert parent header value and set parent rowspan
     */
    function renderRows(table, rows, currDepth, rowDepth, colDepth, prefix = '') {
      var rowKeys = Object.keys(rows);
      if ( currDepth == rowDepth ) {
        return 1;
      }
      var rowSpans = [];
      var retData = { rowSpan: 1, row: null };
      let vRow = rowDepth;
      let vCol = currDepth;
      for ( var i = 0; i < rowKeys.length; i++ ) {
        const key = prefix + rowKeys[i];
        // rendering header cell with children
        if ( currDepth < rowDepth - 1 ) {
          var ret = this.renderRows(table, rows[rowKeys[i]], currDepth + 1, rowDepth, colDepth, key);
          if ( ret.row ) {
            var el = foam.u2.Element.create({nodeName: 'th'});
            el.attrs({ 'rowspan' : ret.rowSpan, 'data-vcol': vCol, 'data-vrow': vRow })
              .addClass(this.myClass('th'))
              .add(rowKeys[i])
              .on('mouseover', () => this.onCellMouseOver(null, key))
              .on('mouseleave', () => this.onCellMouseLeave())
              .enableClass(this.myClass('highlighted-row'), this.slot((currentHoverRow) => currentHoverRow === key || key.startsWith(currentHoverRow) || currentHoverRow?.startsWith(key) ));
            ret.row.insertBefore(el, ret.row.children[0]);
            if ( i == 0 ) retData.row = ret.row;
          }
          rowSpans.push(ret.rowSpan);
          vRow += ret.rowSpan
        } else {
          // rendering childless header with row of values
          var row = table.start('tr').addClass(this.myClass('tr'))
          this.renderCell(row, 'th', { 'data-vcol': vCol, 'data-vrow': vRow }, rowKeys[i], null, key);
          if ( this.colIndexMap?.length ) {
            // case: table has columns
            // get flattened map of column keys and values 
            var map = this.flattenMap(rows[rowKeys[i]], colDepth);
            row.forEach(this.colIndexMap, col => {
              const c = col;
              this.renderCell(row, 'td', {}, map[c] || '', c, key);
            })
          } else {
            // case: rows only table
            this.renderCell(row, 'td', {}, rows[rowKeys[i]], null, key);
          }
          row.end();
          if ( i == 0 ) retData.row = row;
          rowSpans.push(1);
          vRow++;
        } 
      }
      retData.rowSpan = rowSpans.reduce((x, y) => x + y, 0);
      return retData;
    },

    /**
     * renders column values in the case of columns only table
     * @param {*} cols - nested map of col headers and values
     */
    function renderColVals(table, cols, colDepth) {
      cols = this.flattenMap(cols, colDepth);
      var row = table.start('tr').addClass(this.myClass('tr'));
      for ( const key in cols ) {
        const val = cols[key];
        this.renderCell(row, 'td', {}, val, key, null);
      }
      row.end();
    },

    // render cell helper method
    function renderCell(parentEl, cellType, attrs, val, mouseOverKeyCol, mouseOverKeyRow) {
      parentEl.start(cellType)
        .addClass(this.myClass(cellType))
        .attrs(attrs)
        .on('mouseover', () => this.onCellMouseOver(mouseOverKeyCol, mouseOverKeyRow))
        .on('mouseleave', () => this.onCellMouseLeave())
        .enableClass(this.myClass('highlighted-col'),
          this.slot((currentHoverCol, currentHoverRow) =>
            currentHoverCol === mouseOverKeyCol || 
            currentHoverCol?.startsWith(mouseOverKeyCol) || 
            mouseOverKeyCol?.startsWith(currentHoverCol) ||
            currentHoverRow === mouseOverKeyRow || 
            currentHoverRow?.startsWith(mouseOverKeyRow) || 
            mouseOverKeyRow?.startsWith(currentHoverRow)
          ))
        .add(val)
      .end();
    },

    // convert the nested groupbys into a simpler nested dictionary
    function makeDictionary(data) {
      if ( ! foam.mlang.sink.GroupBy.isInstance(data) ) return data?.valueOf() || data;
      var ret = {};
      var keys = data.sortedKeys();
      for ( var i = 0; i < keys.length; i++ ) {
        ret[keys[i]] = this.makeDictionary(data.groups[keys[i]]);
      }
      return ret;
    },

    // collect the col keys that actually appear in the row data
    function getColsFromRows(rows, currDepth, cols, depth, colData) {
      if ( ! rows ) return this.makeDictionary(colData);
      var keys = rows?.sortedKeys() || [];
      if ( currDepth === depth ) {
        keys.forEach(key => {
          if ( ! cols[key] ) cols[key] = {};
          this.addToColsHelper(cols[key], rows.groups[key]);
        })
      } else {
        keys.forEach(key => {
          this.getColsFromRows(rows.groups[key], currDepth + 1, cols, depth);
        })
      }
      return cols;
    },
    function addToColsHelper(ret, toMerge) {
      if ( ! this.GroupBy.isInstance(toMerge) ) return;
      var keys = toMerge.sortedKeys();
      keys.forEach(key => {
        if ( typeof toMerge.groups[key] === 'object' && toMerge[key] !== null ) {
          if ( ! ret[key] ) ret[key] = {};
          this.addToColsHelper(ret[key], toMerge.groups[key]);
        } else {
          ret[key] = toMerge.groups[key];
        }
      })
    },

    // flatten a nested map into a simple one, where the keys are paths of the nested vals
    function flattenMap(obj, colDepth, prefix = '') {
      var map = {};
      for (var key in obj) {
        var val = obj[key];
        if ( colDepth > 1 && typeof val === 'object' && val !== null ) {
          Object.assign(map, this.flattenMap(val, colDepth - 1, prefix + key));
        } else {
          map[prefix + key] = val;
        }
      }
      return map;
    },

    // helper methods for cell highlighting
    function onCellMouseOver(col, row) {
      if ( col ) this.currentHoverCol = col;
      if ( row ) this.currentHoverRow = row;
    },
    function onCellMouseLeave() {
      this.currentHoverCol = undefined;
      this.currentHoverRow = undefined;
    }
  ],
  listeners: [
    {
      name: 'applyOffsets',
      isFramed: true,
      on: ['data.propertyChange.stickyHeaders'],
      code: function applyOffsets() {
        if ( ! this.renderComplete ) return;

        const table = this.table.el_();
        const thElements = table.querySelectorAll('th');

        if ( ! this.data.stickyHeaders ) {
          thElements.forEach(th => {
            if (th.closest('tr[data-type="header-row"]')) {
              th.style.top = 'unset';
            } else {
              th.style.left = 'unset';
            }
          })
        }

        const rows = table.rows;
        let firstNonHeaderRow = Array.from(rows).find(r => r.dataset.type !== 'header-row')

        const rowHeights = this.rowHeightCache.length ? 
                           this.rowHeightCache : 
                           Array.from(rows).map(row => row.getBoundingClientRect().height);

        // We only check the first row's cells to get the base widths
        const colWidths = this.colWidthCache || [];
        if ( ! colWidths.length ) {
          Array.from(firstNonHeaderRow.cells).forEach((cell, idx) => {
            // Width per visual slot (handling colspan)
            const unitWidth = cell.offsetWidth / (cell.colSpan || 1);
            const vCol = parseInt(cell.dataset.vcol);
            for (let i = 0; i < (cell.colSpan || 1); i++) {
              colWidths[vCol + i] = unitWidth;
            }
          });
        }

        thElements.forEach(th => {
          const vCol = parseInt(th.dataset.vcol);
          const vRow = parseInt(th.dataset.vrow);

          // Summing offsets using slice/reduce (very fast for table scales)
          const leftOffset = colWidths.slice(0, vCol).reduce((a, b) => a + b, 0);
          const topOffset = rowHeights.slice(0, vRow).reduce((a, b) => a + b, 0);

          // Vertical Stickiness (Header)
          if (th.closest('tr[data-type="header-row"]')) {
            th.style.top = `${topOffset}px`;
          } else {
            th.style.left = `${leftOffset}px`;
          }
        });
      }
    }
  ]
});
