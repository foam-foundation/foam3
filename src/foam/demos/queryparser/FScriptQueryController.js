/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.queryparser',
  name: 'FScriptQueryController',
  extends: 'foam.u2.Controller',

  requires: [
    'foam.parse.FScriptParser'
  ],

  properties: [
    {
      class: 'String',
      name: 'query',
      onKey: true, // not the default
      width: 100,
      view: function(_, X) {
        return {
          class: 'foam.parse.auto.SmartView',
          parser: X.data.parser
        };
      }
    },
    {
      name: 'parser',
      factory: function() {
        return this.FScriptParser.create({of: foam.core.auth.User});
      }
    },
    {
      name: 'predicate',
      expression: function(query) {
        console.log('*** parsing query ***: ' + query + ' length ' + query.length );
        let ps = this.parser.parseString( query + String.fromCharCode(26));
        return ps || null;
      }
    },
    {
      class: 'String',
      name: 'result',
      visibility: 'RO',
      width: 100,
      expression: function(predicate) {
        return predicate ? predicate.toString() : '';
      }
    }
  ],

  methods: [
    function render() {
      this.add(this.QUERY.__);
      this.br().add(this.RESULT.__);
    }
  ]
});
