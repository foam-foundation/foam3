/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ViewSink',
  extends: 'foam.dao.ArraySink',

  methods: [
    function addToE(e) {
      e = e.startContext({controllerMode: foam.u2.ControllerMode.VIEW});

      this.array.forEach(o => {
        var args = {showActions: true, data: o};
        if ( this.__context__.columnStorage && this.__context__.columnStorage[o.cls_.id] ) {
          args.properties = JSON.parse(this.__context__.columnStorage[o.cls_.id]).map(p => p[0]);
        }
        e.tag(foam.u2.DetailView, args);
      });
    }
  ]
});
