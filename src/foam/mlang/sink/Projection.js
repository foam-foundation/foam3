/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.sink',
  name: 'Projection',
  extends: 'foam.dao.AbstractSink',
  implements: [ 'foam.lang.Serializable' ],

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.mlang.Expr',
    'java.util.Arrays',
    'java.util.ArrayList',
    'java.util.concurrent.ConcurrentHashMap',
    'java.util.List',
    'java.util.Map',
    'java.util.StringJoiner'
  ],

  constants: [
    {
      name: 'CLS_OR_OBJ_INDEX',
      type: 'Integer',
      value: 0
    },
    {
      name: 'PROJECTION_VALUES_OFFSET',
      type: 'Integer',
      value: 1
    }
  ],

  properties: [
    {
      class: 'Array',
      type: 'foam.mlang.Expr[]',
      name: 'exprs',
      documentation: 'The expressions to be evaluated and returned in the projection. Typically are Properties.',
    },
    {
      class: 'Boolean',
      name: 'useProjection',
      documentation: 'if objects should be build from projectionWithClass (and they will not be retrieved with select)',
      value: true
    },
    {
      class: 'List',
      name: 'projectionWithClass',
      documentation: 'The projection but with the class or full object in position 0 with all other values offset by 1.',
      factory: function() { return []; },
      javaFactory: `return new java.util.ArrayList();`
    },
    {
      class: 'List',
      documentation: 'The projection with the class removed and all values in the same position as in "exprs".',
      name: 'projection',
      transient: true,
      factory: function() { 
        let val = []
        this.projectionWithClass.forEach(v => {
          let res = v.slice(this.PROJECTION_VALUES_OFFSET);
          if ( ! this.useProjection ) {
            this.exprs.forEach((e, i) => {
              if ( foam.lang.Property.isInstance(e) ) {
                res[i] = e.f(v[this.CLS_OR_OBJ_INDEX]);
              }
            })
          }
          val.push(res);
        });
        return val;
      },
      javaFactory: `
        List result = new ArrayList();
        if ( getProjectionWithClass() != null ) {
          for ( Object list: (ArrayList)getProjectionWithClass() ) {
            Object[] obj1 = Arrays.copyOfRange((Object[])list, PROJECTION_VALUES_OFFSET, ((Object[])list).length);
            result.add(obj1);
          }
        }
        return result;
      `
    },
    {
      class: 'List',
      name: 'array',
      // transient: true,
      documentation: 'An array of full objects created from the projection. Only properties included in exprs/the-projection will be set.',
      factory: function() {
        return this.projectionWithClass.map(p => {
          if ( this.useProjection ) {
            var o = foam.lookup(p[this.CLS_OR_OBJ_INDEX]).create(null, this);
            for ( var i = 0 ; i < this.exprs.length ; i++ ) {
              try {
                this.exprs[i].set(o, p[i+this.PROJECTION_VALUES_OFFSET]);
              } catch (x) {
              }
            }
            return o;
          }
          return p[this.CLS_OR_OBJ_INDEX];
        });
      },
      javaFactory: `
        var a  = new java.util.ArrayList();
        var es = getExprs();
        var p  = getProjectionWithClass();
        for ( int i = 0 ; i < p.size() ; i++ ) {
          if ( getUseProjection() )  {
            try {
              Object[]  arr = (Object[]) p.get(i);
              ClassInfo ci  = (ClassInfo) arr[CLS_OR_OBJ_INDEX];
              Object    o   = ci.newInstance();

              for ( int j = 0 ; j < es.length ; j++ ) {
                if ( es[j] instanceof PropertyInfo ) {
                  PropertyInfo e = (PropertyInfo) es[j];
                  e.set(o, arr[i]);
                } else if ( es[j] instanceof foam.core.column.NestedPropertiesExpression ) {
                  foam.core.column.NestedPropertiesExpression e = (foam.core.column.NestedPropertiesExpression) es[j];
                  e.set(o, arr[i]);
                }
              }

              a.set(i, o);
            } catch (Throwable t) {}
          } else {
            a.set(i, p.get(0));
          }
        }
        return a;
      `
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(o, sub) {
        var a;
        if ( this.useProjection ) {
          a = [o.cls_.id];
          for ( var i = 0 ; i < this.exprs.length ; i++ )
            a[i+this.PROJECTION_VALUES_OFFSET] = this.exprs[i].f(o);
        } else {
          a = [o];
        }
        this.projectionWithClass.push(a);
      },
// TODO:      swiftCode: 'array.append(obj)',
      javaCode: `
        Object[] a = new Object[getExprs().length+PROJECTION_VALUES_OFFSET];
        if ( ! getUseProjection() ) {
          a[CLS_OR_OBJ_INDEX] = obj;
        } else {
          a[CLS_OR_OBJ_INDEX] = ((FObject) obj).getClassInfo();
        }
        var oldX = ((FObject) obj).getX();
        synchronized ( this ) {
          for ( int i = 0 ; i < getExprs().length ; i++ ) {
            if ( getExprs()[i] instanceof foam.core.column.NestedPropertiesExpression &&
                ((FObject) obj).getX().get("projectionReferenceCache") == null ) {
              // put a map into the object context for caching reference lookups
              // key = referentClass+referentId
              // storing fobject directly instead of softreference since this will presumably only last a second anyways
              Map<String, FObject> referenceCache = new ConcurrentHashMap<>();
              var x = ((FObject) obj).getX().put("projectionReferenceCache", referenceCache);
              ((FObject) obj).setX(x);
            }
            a[i+this.PROJECTION_VALUES_OFFSET] = getExprs()[i] != null ? getExprs()[i].f(obj) : null;
          }
        }
        ((FObject) obj).setX(oldX);

        getProjectionWithClass().add(a);
      `
    },
    {
      name: 'toString',
      code: function() {
        return this.cls_.name + '(' + this.exprs.join(',') + ')';
      },
      javaCode: `
        StringJoiner joiner = new StringJoiner(", ", getClassInfo().getId() + "(", ")");

        for ( Expr expr : getExprs() ) {
          joiner.add(expr.toString());
        }

        return joiner.toString();
      `
    }
  ]
});
