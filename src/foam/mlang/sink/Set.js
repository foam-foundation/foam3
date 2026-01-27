/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Set',
  extends: 'foam.dao.AbstractSink',
  implements: ['foam.lang.Serializable', 'foam.mlang.sink.Reducible'],

  documentation: 'Sink which collects unique values into a set/list.',

  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg1',
      documentation: 'Expression to evaluate for each object (optional, defaults to identity)'
    },
    {
      class: 'List',
      name: 'values',
      factory: function() { return []; },
      javaFactory: 'return new java.util.ArrayList();'
    },
    {
      class: 'Object',
      name: 'seen',
      hidden: true,
      documentation: 'Track seen values for uniqueness',
      factory: function() { return {}; },
      javaType: 'java.util.Set',
      javaFactory: 'return new java.util.HashSet();',
      javaGetter: `
        if ( seen_ == null ) {
          seen_ = new java.util.HashSet();
        }
        return seen_;
      `,
      javaSetter: `
        seen_ = val;
      `
    }
  ],

  methods: [
    {
      name: 'put',
      code: function(obj, sub) {
        var value = this.arg1 ? this.arg1.f(obj) : obj;
        var key = this.toKey(value);

        if ( ! this.seen[key] ) {
          this.seen[key] = true;
          this.values.push(value);
        }
      },
      javaCode: `
Object value = getArg1() != null ? getArg1().f(obj) : obj;
if ( getSeen().add(value) ) {
  getValues().add(value);
}
      `
    },

    {
      name: 'toKey',
      code: function(value) {
        // Convert value to a unique key for tracking
        if ( value == null ) return 'null';
        if ( typeof value === 'object' ) return JSON.stringify(value);
        return String(value);
      }
    },

    {
      name: 'reduce',
      args: 'foam.mlang.sink.Reducible other',
      code: function(other) {
        if ( ! other || ! foam.mlang.sink.Set.isInstance(other) ) return;

        // Merge unique values from other set
        other.values.forEach(v => {
          var key = this.toKey(v);
          if ( ! this.seen[key] ) {
            this.seen[key] = true;
            this.values.push(v);
          }
        });
      },
      javaCode: `
if ( other == null || !(other instanceof foam.mlang.sink.Set) ) return;
foam.mlang.sink.Set otherSet = (foam.mlang.sink.Set) other;
for ( Object value : otherSet.getValues() ) {
  if ( getSeen().add(value) ) {
    getValues().add(value);
  }
}
      `
    },

    {
      name: 'reset',
      code: function() {
        this.values = [];
        this.seen = {};
      },
      javaCode: `
getValues().clear();
getSeen().clear();
      `
    },

    function toString() {
      return 'SET(' + (this.arg1 ? this.arg1.toString() : '') + ')';
    },

    function toSummary() {
      return this.values.join(', ');
    },

    function addToE(e) {
      e.add(this.values.join(', '));
    },

    function toProperties() {
      var name = this.arg1 ? ('set_' + this.arg1.name) : 'values';
      return [{
        class: 'List',
        name: name,
        label: 'SET(' + (this.arg1 ? foam.String.labelize(this.arg1.name) : 'Values') + ')'
      }];
    },

    function setPropertyValues(o, sink, ps) {
      ps[0].set(o, sink.values);
    }
  ]
});
