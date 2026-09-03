/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'BadBlock',

  constants: { BLOCK_KIND: 'script' },

  imports: [
    'flow'
  ],

  properties: [
    {
      class: 'String',
      name: 'cmd',
      factory: function() { return this.block.cmd; },
      transient: true
    },
    {
      class: 'String',
      name: 'script',
      reactive: false,
      value: '[\n\t\n]', // Is needed so that mementoMgr doesn't get confused on the first state
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 60 },
      // ???: Why is this needed?
      toJSON: function (value, outputter) {
        return outputter.escape(value, true);
      }
    },
    {
      class: 'String',
      reactive: false,
      name: 'error',
      visibility: 'RO'
    },
    {
      name: 'block',
      hidden: true,
      transient: true
    }
  ],

  actions: [
    function repair() {
      var self = this;
      var json = JSON.parse(this.flow.script);
      var name = this.block.flowName;

      function repair(json) {
        for ( let i = 0 ; i < json.length ; i++ ) {
          let js = json[i];
          if ( js.flowName === name ) {
            var newJson = JSON.parse(self.script);
            newJson.cmd = self.cmd;
            json[i] = newJson;
            return;
          }
          if ( js.flowChildren ) repair(js.flowChildren);
        }
      }

      repair(json);
      this.flow.script = JSON.stringify(json);
    }
  ]
});
