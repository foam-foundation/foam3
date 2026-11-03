/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.cmd',
  name: 'Flows',
  extends: 'foam.core.reflow.cmd.Command',

  requires: [ 'foam.core.reflow.Flow' ],

  imports: [ 'flowDAO?' ],

  properties: [
    [ 'description', 'Flows available to load' ]
  ],

  methods: [
    function execute(q) {
      if ( ! this.flowDAO ) return;
      if ( q ) q = q.toLowerCase();
      var self = this;
      this.out.start('table').attr('cellpadding', '6px').select(this.flowDAO.orderBy(this.Flow.CATEGORY, this.Flow.NAME), function(f) {
        if ( q != undefined && (f.id + f.category + f.status + f.description).toLowerCase().indexOf(q) == -1 ) return;
        // TODO: use a real TableView instead
        // FROM flowDAO ORDER BY -category,name COLUMNS category,name,status,description TO CSV
        this.start('tr').
          start('td').add(f.category).end().
          start('td').start(self.Link).add(f.name).on('click', () => self.eval_('load("' + f.name + '")')).end().end().
          start('td').call(function() { f.STATUS.tableCellFormatter.f.call(this, f.status); }).end().
          start('td').add(f.description).end().
        end();
      });
    }
  ]
});
