/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ViewSink',
  extends: 'foam.dao.ArraySink',

  imports: [ 'block' ],

  methods: [
    function addToE(e) {
      var self = this;

      e.add(this.block.value.dynamic(function(columns) {
        e = this.startContext({controllerMode: foam.u2.ControllerMode.VIEW});

        self.array.forEach(o => {
          var args = {showActions: true, data: o};
          if ( columns ) {
            args.properties = columns.split(',').map(p => o.cls_.getAxiomByName(p));
          }
          e.tag(foam.u2.DetailView, args);
        });
      }));
    }
  ]
});
