/**
 * @license
 * Copyright 2015 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Script',

  imports: [
    'data as block',
    'eval_',
    'scope'
  ],

  documentation: `
    In scripts, 'this' is bound to the containing block, so you can do things like:
      this.tag(foam.demos.clock.Clock.create({x:400,y:400}));

    As a result, log() will log to the Script output,
    but this.log() will log to the block, ie. in the FLOW document itself.

  `,

  properties: [
    {
      class: 'String',
      name: 'code',
      reactive: false,
      view: {
        class: 'foam.u2.view.ObjAltView',
        views: [
          [ {class: 'foam.u2.view.CodeView', config: { width: '100%', mode: 'JAVASCRIPT', showGutter: false }}, 'Code'],
          [ {class: 'foam.u2.tag.TextArea', rows: 16 }, 'Plain Text']
        ]
      },
      displayWidth: 60
    },
    {
      class: 'String',
      name: 'output',
      transient: true,
      reactive: false,
      view: { class: 'foam.u2.tag.TextArea', rows: 8 },
      displayWidth: 60
    },
    { class: 'Boolean', name: 'autoRun', view: { class: 'foam.u2.Switch' } }
  ],

  methods: [
    function onLoad() {
      if ( this.autoRun ) return this.run();
    },

    function log() {
      this.output += Array.from(arguments).join(' ') + '\n';
    }
  ],

  actions: [
    function run() {
      let self = this;
      with ( this.scope ) {
        with ( { log: this.log.bind(this) } ) {
          var ret = eval('(async function() {' + self.code + '})').call(self.block);
          ret.then(v => this.log(v), v => this.log(v));
          return ret;
        }
      }
    },

    function clearOutput() {
      this.output = '';
    },

    {
      name: 'createTest',
      availablePermissions: [ 'command.read.test' ],
      code: async function() {
        var name = this.block.flowName;
        this.eval_(`test(${name}.output, 'Test script output for ${name}')`);
      }
    }
  ]
});
