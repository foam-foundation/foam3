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
      view: { class: 'foam.u2.tag.TextArea', rows: 16 },
      displayWidth: 60
    },
    {
      class: 'String',
      name: 'output',
      transient: true,
      reactive: false,
      view: { class: 'foam.u2.tag.TextArea', rows: 8 },
      displayWidth: 60
    }
  ],

  methods: [
    function log() {
      this.output += Array.from(arguments).join(' ') + '\n';
    }
  ],

  actions: [
    function run() {
      with ( this.scope ) {
        with ( { log: this.log.bind(this) } ) {
          this.log(eval('(function() {' + this.code + '})').call(this.block));
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
