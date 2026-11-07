/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'PredicatedListenerTest',
  extends: 'foam.core.test.Test',

  documentation: `A listen with a predicate hears only rows that match it (#5817).
    A row that never matched is never sent, not even as a remove. A row the
    listener was given and that stops matching goes out as a remove that holds
    only its id, so its new fields stay out of reach.`,

  javaImports: [
    'foam.core.auth.User',
    'foam.lang.Detachable',
    'foam.lang.X',
    'foam.mlang.MLang',
    'foam.mlang.predicate.Predicate',
    'java.util.ArrayList',
    'java.util.List'
  ],

  classes: [
    {
      name: 'Heard',
      documentation: 'Keeps every event a listener gets, in order: "put 1", "remove 1".',
      extends: 'foam.dao.AbstractSink',
      properties: [
        {
          class: 'List',
          name: 'events',
          javaFactory: 'return new java.util.ArrayList();'
        },
        {
          class: 'List',
          name: 'rows',
          javaFactory: 'return new java.util.ArrayList();'
        }
      ],
      methods: [
        {
          name: 'put',
          javaCode: 'getEvents().add("put " + ((User) obj).getId()); getRows().add(obj);'
        },
        {
          name: 'remove',
          javaCode: 'getEvents().add("remove " + ((User) obj).getId()); getRows().add(obj);'
        }
      ]
    }
  ],

  methods: [
    {
      name: 'user',
      args: 'X x, long id, String spid, String lastName',
      javaType: 'User',
      javaCode: `
        return new User.Builder(x).setId(id).setSpid(spid).setLastName(lastName).build();
      `
    },
    {
      name: 'runTest',
      javaCode: `
        listenerKeepsUnmatchedRowsOut(x);
        rowThatLeavesGoesOutAsIdOnly(x);
        matchingRemoveGoesOutWhole(x);
        filteredDAODoesNotLeakOutOfScopeRows(x);
      `
    },
    {
      name: 'listenerKeepsUnmatchedRowsOut',
      args: 'X x',
      javaCode: `
        DAO   dao   = new MDAO(User.getOwnClassInfo());
        Heard heard = new Heard();
        dao.listen(heard, MLang.EQ(User.SPID, "a"));

        dao.put(user(x, 1, "b", "Secret"));
        test(heard.getEvents().isEmpty(),
          "a put that never matched sends nothing, got " + heard.getEvents());

        dao.remove(user(x, 1, "b", "Secret"));
        test(heard.getEvents().isEmpty(),
          "a remove that never matched sends nothing, got " + heard.getEvents());
      `
    },
    {
      name: 'rowThatLeavesGoesOutAsIdOnly',
      args: 'X x',
      javaCode: `
        DAO   dao   = new MDAO(User.getOwnClassInfo());
        Heard heard = new Heard();
        dao.listen(heard, MLang.EQ(User.SPID, "a"));

        dao.put(user(x, 2, "a", "Shown"));
        dao.put(user(x, 2, "b", "Secret"));
        test(heard.getEvents().toString().equals("[put 2, remove 2]"),
          "a row that stops matching goes out as a remove, got " + heard.getEvents());

        User gone = (User) heard.getRows().get(1);
        test(gone.getId() == 2 && "".equals(gone.getLastName()) && "".equals(gone.getSpid()),
          "the remove holds only the id, got lastName '" + gone.getLastName() + "' spid '" + gone.getSpid() + "'");

        dao.put(user(x, 2, "b", "Secret again"));
        dao.remove(user(x, 2, "b", "Secret again"));
        test(heard.getEvents().size() == 2,
          "once gone, the row's later changes send nothing, got " + heard.getEvents());

        dao.put(user(x, 2, "a", "Back"));
        test(heard.getEvents().toString().equals("[put 2, remove 2, put 2]"),
          "a row that matches again is put again, got " + heard.getEvents());
      `
    },
    {
      name: 'matchingRemoveGoesOutWhole',
      args: 'X x',
      javaCode: `
        DAO dao = new MDAO(User.getOwnClassInfo());
        // Read before listening, as a cache does: the listener never got this row through put.
        dao.put(user(x, 3, "a", "Shown"));
        Heard heard = new Heard();
        dao.listen(heard, MLang.EQ(User.SPID, "a"));

        dao.remove(user(x, 3, "a", "Shown"));
        User gone = heard.getRows().isEmpty() ? null : (User) heard.getRows().get(0);
        test(heard.getEvents().toString().equals("[remove 3]") && "Shown".equals(gone.getLastName()),
          "a remove of a matching row goes out whole, even one the listener only read, got " + heard.getEvents());
      `
    },
    {
      name: 'filteredDAODoesNotLeakOutOfScopeRows',
      args: 'X x',
      javaCode: `
        DAO         delegate = new MDAO(User.getOwnClassInfo());
        FilteredDAO scoped   = new FilteredDAO.Builder(x).setPredicate(MLang.EQ(User.SPID, "a")).setDelegate(delegate).build();
        Heard       heard    = new Heard();
        scoped.listen(heard, null);

        delegate.put(user(x, 4, "b", "Secret"));
        test(heard.getEvents().isEmpty(),
          "FilteredDAO: a row outside the scope never reaches the listener, got " + heard.getEvents());

        delegate.put(user(x, 5, "a", "Shown"));
        test(heard.getEvents().toString().equals("[put 5]"),
          "FilteredDAO: a row inside the scope is put, got " + heard.getEvents());
      `
    }
  ]
});
