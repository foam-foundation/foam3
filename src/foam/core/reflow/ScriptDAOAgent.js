/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ScriptDAOAgent',
  extends: 'foam.core.reflow.AbstractSinkDAOAgent',

  properties: [
    {
      class: 'String',
      name: 'code',
      value: '// var o is the current object\nlog(o.id);\n',
      view: { class: 'foam.u2.tag.TextArea', rows: 6 },
      displayWidth: 60
    }
  ],

  methods: [
    function execute(e) {
      return this.dao.select(this.createSink()).then(s => {
        var a = s.array;
        for ( var i = 0 ; i < a.length ; i++ ) {
          var o = a[i];
          // TODO: get a better scope from Console
          with ( { o: o, log: this.__context__.log } ) {
            eval(this.code);
          }
        }
      });
    },
    function createSink() { return this.ArraySink.create(); },
    function addToE(e) {
      e.startContext({data: this}).start().style({display: 'flex'}).
        add(this.CODE);
    }
  ]
});
