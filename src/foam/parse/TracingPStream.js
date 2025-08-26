/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse',
  name: 'TracingPStream',
  implements: ['foam.parse.JSPStream'],

  documentation: 'PStream decorator to add tracing. Used for debugging parsers.',

  constants: { DEPTH: [ 0 ] },

  properties: [
    {
      name: 'delegate'
    },
    {
      name: 'head',
      getter: function() { return this.delegate.head; },
    },
    {
      name: 'tail',
      factory: function() {
        return this.cls_.create({delegate: this.delegate.tail});
      }
    },
    {
      name: 'valid',
      getter: function() { return this.delegate.valid; }
    },
    {
      name: 'value',
      getter: function() { return this.delegate.value; }
    }
  ],

  methods: [
    function setValue(value) {
      return this.cls_.create({delegate: this.delegate.setValue(value) });
    },

    function substring(end) {
      this.delegate.substring(end);
    },

    function apply(p, obj) {
      try {
        this.DEPTH[0] = this.DEPTH[0]+1;
        console.log('------------------------------------------------------------------------------------------------------------------------------------------------'.substring(0, this.DEPTH[0]), '*** trace', p.toString());
        return p.parse(this, obj);
      } finally {
        this.DEPTH[0] = this.DEPTH[0]-1;
      }

    },

    function compareTo(other) {
      return this.delegate.compareTo(other.delegate);
    }
  ]
});
