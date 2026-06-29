/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.perf',
  name: 'StructuralMarker',
  implements: [ 'foam.core.reflow.perf.PerfMarker' ],

  documentation: `Marks known structural smells by walking the loaded flow's live Block
    instances (report.sourceBlocks, set by loadPerf from the Console's flowChildren).
    Uses typed isInstance checks and real agent properties - robust to short-name
    serialization, unlike scanning the script JSON. Same-smell blocks are grouped into
    one issue listing their names. No sourceBlocks (manual capture) -> returns [].`,

  requires: [
    'foam.core.reflow.perf.PerfIssue',
    'foam.core.reflow.perf.PerfSeverity',
    'foam.core.reflow.DAOPrompt',
    'foam.core.reflow.TableDAOAgent',
    'foam.core.reflow.GroupByDAOAgent'
  ],

  methods: [
    function mark(report) {
      var self            = this;
      var DAOPrompt       = this.DAOPrompt;
      var Table           = this.TableDAOAgent;
      var GroupBy         = this.GroupByDAOAgent;
      var hiddenTables    = [];
      var leftoverGroupBy = [];

      function rendersTable(sel) {
        // A DAOPrompt with no select falls back to the default TableView.
        return ! sel || Table.isInstance(sel);
      }
      function walk(b) {
        if ( ! b ) return;
        var v = b.value;
        if ( DAOPrompt.isInstance(v) ) {
          if ( b.shown === false && rendersTable(v.select) ) hiddenTables.push(b.flowName || '?');
          var sel = v.select;
          if ( GroupBy.isInstance(sel) && sel.prop == null && sel.browseEnabled && sel.groupLimit === -1 )
            leftoverGroupBy.push(b.flowName || '?');
        }
        ( b.flowChildren || [] ).forEach(walk);
      }
      ( report.sourceBlocks || [] ).forEach(walk);

      var out = [];
      if ( hiddenTables.length )
        out.push(self.PerfIssue.create({ severity: self.PerfSeverity.WARN, category: 'Structure',
          detail: hiddenTables.length + ' hidden block(s) render a full table while shown:false (wasted DOM over a large DAO): ' + hiddenTables.join(', ') }));
      if ( leftoverGroupBy.length )
        out.push(self.PerfIssue.create({ severity: self.PerfSeverity.WARN, category: 'Structure',
          detail: leftoverGroupBy.length + ' GroupBy block(s) browse every row with no grouping property - likely leftover scaffolding: ' + leftoverGroupBy.join(', ') }));
      return out;
    }
  ]
});
