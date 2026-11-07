/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.dao',
  name: 'PredicatedListener',
  extends: 'foam.dao.ProxySink',

  documentation: `Passes on only the events whose row matches the predicate.
    In Java it also tells the listener when a row it was given leaves the
    predicate: a remove that holds only the row's id. A row the listener was
    never given is never sent, so a decorator that scopes a listen with a
    predicate (FilteredDAO.predicateIn) does not leak rows outside the scope
    as removes. Ids it was given are kept in passedIds_, one per matching row.`,

  javaImports: [
    'foam.lang.FObject'
  ],

  axioms: [
    {
      name: 'javaPassedIds',
      buildJavaClass: function(cls) {
        // A plain field, not a property: a property would change the
        // generated (predicate, delegate) constructor that AbstractDAO uses.
        cls.extras.push(`
          // Ids of the rows this listener was given and has not been told are gone.
          protected final java.util.Set<Object> passedIds_ = java.util.concurrent.ConcurrentHashMap.newKeySet();
        `);
      }
    }
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      required: true,
      name: 'predicate'
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, sub) {
        if ( this.predicate.f(obj) ) this.delegate.put(obj, sub);
      },
      swiftCode: 'if predicate.f(obj) { delegate.put(obj, sub) }',
      javaCode: `
        Object id = idOf(obj);
        if ( getPredicate().f(obj) ) {
          passedIds_.add(id);
          getDelegate().put(obj, sub);
        } else if ( passedIds_.remove(id) ) {
          // The row left the listener's view. Its new fields may be outside
          // the scope, so only its id goes out.
          getDelegate().remove(idOnly(obj), sub);
        }
      `
    },
    {
      name: 'remove',
      code: function remove(obj, sub) {
        if ( this.predicate.f(obj) ) this.delegate.remove(obj, sub);
      },
      swiftCode: 'if predicate.f(obj) { delegate.remove(obj, sub) }',
      javaCode: `
        Object  id     = idOf(obj);
        boolean passed = passedIds_.remove(id);
        // A matching row is inside the scope even when this listener only
        // read it through select, so it goes out whole, as before.
        if ( getPredicate().f(obj) )  getDelegate().remove(obj, sub);
        else if ( passed )            getDelegate().remove(idOnly(obj), sub);
      `
    },
    {
      name: 'idOf',
      flags: ['java'],
      args: 'Object obj',
      javaType: 'Object',
      javaCode: 'return ((FObject) obj).getProperty("id");'
    },
    {
      name: 'idOnly',
      documentation: 'A new row of the same class that holds only the id of obj.',
      flags: ['java'],
      args: 'Object obj',
      javaType: 'FObject',
      javaCode: `
        FObject out;
        try {
          out = (FObject) ((FObject) obj).getClassInfo().newInstance();
        } catch ( IllegalAccessException | InstantiationException e ) {
          throw new RuntimeException(e);
        }
        out.setProperty("id", idOf(obj));
        return out;
      `
    }
  ]
});
