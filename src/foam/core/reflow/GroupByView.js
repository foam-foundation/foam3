/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'GroupByView',
  extends: 'foam.u2.View',

  documentation: 'Table View for GroupBy mLang.',

  css: `
    ^td { text-align: right; }
    ^ table { border-collapse: collapse; }
  `,

  methods: [
    function render(e) {
      var self = this;
      var data = this.data;

      this.addClass();

      var cols = data.cols.sortedKeys();
      this.start('table').
        attrs({border: '1', cellspacing: 10, cellpadding: 4}).
        start('tr').
          tag('th').
          forEach(cols, function(c) {
            this.start('th').add(c.toString());
          }).
        end().
        forEach(data.rows.sortedKeys(), function(r) {
          var row = data.rows.groups[r];
          this.start('tr').
            start('th').add(r).end().
            forEach(cols, function(c) {
              this.start('td').addClass(self.myClass('td')).add(row.groups[c] || '');
            }).
            end();
        });
    }
  ]
});
