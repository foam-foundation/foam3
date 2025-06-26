/**
 * @license
 * Copyright 2015 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Script',

  imports: [
    'eval_',
    'data',
    'scope'
  ],

  properties: [
    {
      class: 'String',
      name: 'code',
      reactive: false,
      view: { class: 'foam.u2.tag.TextArea', rows: 12 },
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
      this.eval_(this.code);
      /*
      with ( this.scope ) {
        with ( { log: this.log.bind(this) } ) {
          this.log('>', this.code);
          this.log(eval('(function() {' + this.code + '})').call(this.data));
        }
        }
        */
    },

    function clearOutput() {
      this.output = '';
    }
  ]
});
