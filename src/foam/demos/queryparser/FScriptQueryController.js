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
    'foam.parse.SimpleQueryParser',
    'foam.parse.auto.AutoCompleter'
  ],

  properties: [
    {
      name: 'autoCompleter',
      factory: function() {
        let qc = this.AutoCompleter.create({normalize: true});
          this.query$.follow(qc.autoQuery$);
        return qc;
      }
    },
    {
      class: 'String',
      name: 'query',
      onKey: true,
      width: 100,
      view: function(_, X) {
        let view = foam.u2.TextField.create();
        X.data.query$.sub(()=>view.focus());
        return view;
      }
    },
    {
      name: 'parser',
      factory: function() {
        return foam.parse.FScriptParser.create({of: foam.core.auth.User});
//        return this.SimpleQueryParser.create({of: foam.core.auth.User});
//        return this.QueryParser.create({of: foam.util.Timer});
      }
    },
    {
      name: 'predicate',
      expression: function(query) {
        this.autoCompleter.autoQuery = query;
        console.log('*** parsing query ***: ' + query + ' length ' + query.length );
        let ps = this.parser.parseString( query + String.fromCharCode(26), undefined, this.autoCompleter.apply);
        return ps || null;
      }
    },
    {
      class: 'String',
      name: 'result',
      width: 100,
      expression: function(predicate) {
        return predicate ? predicate.toString() : '';
      }
    },
    {
      class: 'String',
      name: 'suggestion'
    }
  ],

  methods: [
    function render() {
      this.add(this.QUERY.__);
      this.autoCompleter.addToE(this);
      this.br().add(this.RESULT.__);
    }
  ]
});
