/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'GroupByView',
  extends: 'foam.u2.View',

  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'groupByBackground',
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
    ^table, ^td, ^th {
      border-collapse: collapse;
      border-spacing: 0;
      border: 1px solid $borderDefault;
    }

    /* Row styling */
    ^tr {
      border: 1px solid $borderDefault;
      transition: background-color 0.2s ease;
    }

    ^tr:hover {
      background: $groupByBackground;
      color: $groupByBackground$foreground;
    }

    /* Cell styling - both TH and TD */
    ^td {
      padding: .8rem 1rem;
      transition: background-color 0.15s ease;
    }
    ^td:hover {
      font-weight: $font-medium;
      background: $highlightCell;
      color: $highlightCell$foreground;
    }
    ^th {
      padding: .8rem 1rem;
      transition: background-color 0.15s ease;
      font-weight: bold;
      cursor: pointer;
      justify-items: anchor-center;
      align-items: anchor-center;
    }

    ^collapse-symbol {
      font-family: monospace;
      justify-self: center;
      align-self: center;
      padding: 0 2px 0 0;
      width: max-content;
      height: max-content;
    }
    ^collapsed-header {
      padding: 0.2rem 1rem;
      font-weight: 400!important;
    }
    ^collapsed-cell {
      border: 0px solid $borderDefault;
      pointer-events: none;
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
  `,

  properties: [
    { name: 'selection' },
    { name: 'collapsedKeys', factory: () => ({}) }
  ],

  methods: [
    function render() {
      var self = this;
      var data = this.data;

      this.addClass();

      var groups = data.groups;
      this.start('table').addClass(this.myClass('table')).start('tbody').
        forEach(data.sortedKeys(), function(g) {
          var key = g.toString();
          this.start('tr').addClass(self.myClass('tr')).
            start('th')
              .addClass(self.myClass('th'))
              .enableClass(self.myClass('collapsed-header'), self.slot(collapsedKeys => collapsedKeys[key]))
              .on('click', () => self.toggleCollapse(key))
              .start()
                .addClass(self.myClass('header-grid'), self.myClass('header-grid-row'))
                .start()
                  .addClass(self.myClass('collapse-symbol'))
                  .add(self.slot(collapsedKeys => collapsedKeys[key] ? '▹' : '◃'))
                .end()
                .start()
                  .add(key)
                .end()
              .end()
            .end().
            start('td')
              .addClass(self.myClass('td'))
              .enableClass(self.myClass('collapsed-cell'), self.slot(collapsedKeys => collapsedKeys[key]))
              .add(self.slot(collapsedKeys => collapsedKeys[key] ? '' : groups[g]?.value || groups[g]))
            .end();
        });
    },
    
    function toggleCollapse(groupKey) {
      this.collapsedKeys[groupKey] = !this.collapsedKeys[groupKey];
      this.collapsedKeys = { ...this.collapsedKeys };
    }
  ]
});
