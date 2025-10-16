/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'GroupBy',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable' ],

  documentation: 'Sink which behaves like the SQL group-by command.',

  requires: [
    'foam.dao.SequenceNumberDAO',
    'foam.mlang.sink.GroupByView',
    'foam.mlang.sink.Sequence'
  ],

  // TODO: it makes no sense to name the arguments arg1 and arg2
  // because this isn't an expression, so they should be more meaningful
  properties: [
    {
      class: 'foam.mlang.ExprProperty',
      name: 'arg1'
    },
    {
      class: 'foam.mlang.SinkProperty',
      name: 'arg2',
      javaFactory: 'return foam.mlang.MLang.COUNT();',
      factory: function() { return foam.mlang.sink.Count.create(); }
    },
    {
      class: 'Int',
      name: 'groupLimit',
      value: -1
    },
    {
      class: 'Map',
      name: 'groups',
      hidden: true,
      javaCloneProperty: '// noop',
      factory: function() { return {}; },
      javaFactory: 'return new java.util.HashMap<Object, foam.dao.Sink>();',
      cloneProperty: function(value, cloneMap) {
        if ( value ) {
          var tmp = cloneMap[this.name] = {};
          for ( var key in value ) {
            /// Need to clone to get expressions to re-evaluate (since without it expressions gets saved)
            tmp[key] = foam.util.clone(value[key]);
          }
        }
      }

    },
    {
      class: 'List',
      hidden: true,
      name: 'groupKeys',
      javaCloneProperty: '// noop',
      // IMPORTANT: Not transient - must be serialized to preserve backend order
      // JavaScript automatically sorts numeric string keys (e.g., "554", "036")
      // which breaks the intended display order from the backend.
      // TopNGroupBy sets this explicitly to maintain value-sorted order (DESC/ASC by sum, count, etc.)
      // Without this, JavaScript would reorder keys numerically instead of by their aggregate values.
      javaFactory: 'return new java.util.ArrayList(this.getGroups().keySet());',
      factory: function() { return Object.keys(this.groups); },
    },
    {
      class: 'Boolean',
      hidden: true,
      name: 'processArrayValuesIndividually',
      documentation: 'If true, each value of an array will be entered into a separate group.',
      factory: function() {
        // TODO: it would be good if it could also detect RelationshipJunction.sourceId/targetId
        return ! foam.lang.MultiPartID.isInstance(this.arg1);
      }
    },
    {
      name: 'selection', hidden: true
    }
  ],

  methods: [
    {
      name: 'sortedKeys',
      javaType: 'java.util.List',
      args: 'foam.mlang.order.Comparator comparator',
      code: function sortedKeys(opt_comparator) {
        var a1 = this.arg1;
        // Use the property as a comparator but adapt to the correct type since number types will be stored as String values
        function safeAdapt(p, v) { return p.adapt ? p.adapt(null, v, p) : v; }

        if ( a1.comparePropertyValues ) {
          this.groupKeys.sort(opt_comparator || ((o1,o2) => a1.comparePropertyValues(safeAdapt(a1, o1), safeAdapt(a1, o2))));
        } else {
          this.groupKeys.sort();
        }
        return this.groupKeys;
      },
      javaCode:
`if ( comparator != null ) {
  java.util.Collections.sort(getGroupKeys(), comparator);
} else {
  if ( getArg1() instanceof java.util.Comparator ) {
    java.util.Collections.sort(getGroupKeys(), (java.util.Comparator) getArg1());
  } else {
    java.util.Collections.sort(getGroupKeys());
  }
}
return getGroupKeys();`
    },
    {
      name: 'putInGroup_',
      args: 'foam.lang.Detachable sub, Object key, Object obj',
      code: function putInGroup_(sub, key, obj) {
        var group = this.groups.hasOwnProperty(key) && this.groups[key];

        if ( ! group ) {
          group = this.arg2.clone();
          this.groupKeys = undefined;
          this.groups[key] = group;
        }
        group.put(obj, sub);
        this.pub('propertyChange', 'groups');
      },
      javaCode:
`foam.dao.Sink group = (foam.dao.Sink) getGroups().get(key);
 if ( group == null ) {
   group = (foam.dao.Sink) (((foam.lang.FObject)getArg2()).fclone());
   ((foam.lang.FObject)group).setX(getX());
   getGroups().put(key, group);
   clearGroupKeys();
 }
 group.put(obj, sub);`
    },

    function reset() {
      this.arg2.reset();
      this.groups    = undefined;
      this.groupKeys = undefined;
    },
    {
      name: 'put',
      code: function put(obj, sub) {
        var key = this.arg1.f(obj);
        if ( this.processArrayValuesIndividually && Array.isArray(key) ) {
          if ( key.length ) {
            for ( var i = 0; i < key.length; i++ ) {
              this.putInGroup_(sub, key[i], obj);
            }
          } else {
            // Perhaps this should be a key value of null, not '', since '' might
            // actually be a valid key.
            this.putInGroup_(sub, '', obj);
          }
        } else {
          this.putInGroup_(sub, key, obj);
        }
        if ( this.groupLimit !== -1 && this.groups.size >= this.groupLimit ) sub.detach();
      },
      javaCode:
`Object arg1 = getArg1().f(obj);
if ( getProcessArrayValuesIndividually() && arg1 instanceof Object[] ) {
  Object[] keys = (Object[]) arg1;
  for ( Object key : keys ) {
    putInGroup_(sub, key, obj);
  }
} else {
  putInGroup_(sub, arg1, obj);
}
/*
if ( getGroupLimit() != -1 ) {
  System.err.println("************************************* " + getGroupLimit() + " " + getGroups().size() + " " + sub);
  Thread.dumpStack();
}*/
if ( getGroupLimit() != -1 && getGroups().size() >= getGroupLimit() && sub != null ) sub.detach();
`
    },

    {
      name: 'eof',
      code: function() {
        // Call eof on all nested sinks to ensure they finalize their state
        for ( var key in this.groups ) {
          var nestedSink = this.groups[key];
          if ( nestedSink && nestedSink.eof ) {
            nestedSink.eof();
          }
        }
      },
      javaCode: `
// Call eof on all nested sinks to ensure they finalize their state
for (Object key : getGroups().keySet()) {
  foam.dao.Sink nestedSink = (foam.dao.Sink) getGroups().get(key);
  if (nestedSink != null) {
    nestedSink.eof();
  }
}
      `
    },

    {
      name: 'toString',
      code: function toString() {
        return 'groupBy(' + this.arg1 + ',' + this.arg2 + ',' + this.groupLimit + ')';
      },
      javaCode: 'return this.getGroups().toString();'
    },

    function toE(_, x) {
      var e = x.E();
      this.addToE(e);
      return e;
    },

    function addToE(e) {
      e.tag(this.GroupByView, {data: this, selection$: this.selection$});
    },

    function merge(other, opt_reducer) {
      return this.cls_.create({
        arg1: this.arg1,
        arg2: this.arg2,
        groups: this.mergeMaps(this.groups, other.groups, opt_reducer)
      });
    },

    function mergeMaps(m1, m2, opt_reducer) {
      var map = {};
      Object.keys(m1).forEach(k => map[k] = true);
      Object.keys(m2).forEach(k => map[k] = true);
      Object.keys(map).forEach(k => {
        var v1 = m1[k];
        var v2 = m2[k];
        map[k] = opt_reducer ? opt_reducer(v1, v2) : this.reduce(v1, v2);
      });
      return map;
    },

    function reduce(v1, v2) {
      // TODO: handle when one is undefined
      return this.Sequence.create({horizontal: true, args: [ v1, v2 ]});
    },

    function genModel() {
      // Get name and label from the expression, with fallbacks
      var exprName = this.arg1.name || this.arg1.delegate?.name || 'group';
      var exprLabel = this.arg1.label || foam.String.labelize(this.arg1.delegate?.name) || 'Group';

      // Determine property class by traversing expressions to find underlying property
      var exprClass = 'String';
      var expr = this.arg1;
      while ( expr ) {
        if ( foam.lang.Property.isInstance(expr) ) {
          exprClass = expr.cls_?.id || 'String';
          break;
        }
        // Try delegate, then arg1, then stop
        expr = expr.delegate || expr.arg1;
      }

      const model = {
        package: 'foam.tmp',
        name: 'GroupBy' + foam.next$UID(),
        ids: [ 'row' ],
        properties: [
          { class: 'Long', name: 'row' },
          { class: exprClass, name: exprName, label: exprLabel }
        ]
      };

      model.plural = model.name;
      var props = this.arg2.toProperties ? this.arg2.toProperties() : this.arg2.VALUE ? [ this.arg2.VALUE ] : [];
      model.properties.push.apply(model.properties, props);

      return model;
    },

    function asDAO() {
      const model = this.genModel();
      foam.CLASS(model);
      var cls = foam.lookup('foam.tmp.' + model.name);

      // So that tableColumns aren't remembered from a previous run
      delete localStorage[cls.id];

      var props  = model.properties.slice(1).map(p => cls.getAxiomByName(p.name));
      var dao    = foam.dao.MDAO.create({of: cls});
      dao = this.SequenceNumberDAO.create({delegate: dao, property: 'row'});

      var o = cls.create({});

      this.processGroupValue(dao, o, props);

      return dao;
    },

    function toProperties() {
      return this.genModel().properties.slice(1);
    },

    function processGroupValue(dao, proto, props) {
      var groups = this.groups;

      var ID = props[0];

      props = props.slice(1);

      this.groupKeys.forEach(k => {
        var group = groups[k];

        var o = proto.clone();
        ID.set(o, k);

        if ( group.processGroupValue ) {
          group.processGroupValue(dao, o, props);
        } else if ( this.arg2.setPropertyValues ) {
          this.arg2.setPropertyValues(o, groups[k], props);
          dao.put(o);
        } else {
          o.value = groups[k].value;
          dao.put(o);
        }
      });
    }
  ]
});
