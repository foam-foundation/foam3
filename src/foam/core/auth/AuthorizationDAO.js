/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'AuthorizationDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: 'A DAO decorator to run authorization checks.',

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.*',
    'foam.mlang.predicate.Predicate',

    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.IS_AUTHORIZED_TO_READ',
    'static foam.mlang.MLang.IS_AUTHORIZED_TO_DELETE'
  ],

  javaCode: `
    public AuthorizationDAO(X x, DAO delegate, Authorizer authorizer) {
      foam.core.logger.Logger log = (foam.core.logger.Logger) x.get("logger");
      setX(x);
      setDelegate(delegate);
      setAuthorizer(authorizer);
    }
  `,

  properties: [
    {
      name: 'authorizer',
      class: 'FObjectProperty',
      of: 'foam.core.auth.Authorizer'
    }
  ],

  methods: [
    {
      name: 'put_',
      javaThrows: [
        'foam.core.auth.AuthorizationException'
      ],
      javaCode: `
   if ( obj == null ) throw new RuntimeException("Cannot put null.");

    Object  id       = obj.getProperty("id");
    FObject oldObj   = getDelegate().find(id);
    boolean isCreate = id == null || oldObj == null;

    if ( isCreate ) {
      getAuthorizer().authorizeOnCreate(x, obj);
    } else {
      getAuthorizer().authorizeOnUpdate(x, oldObj, obj);
    }

    return super.put_(x, obj);
`
    },
    {
      name: 'remove_',
      javaCode: `
    Object id = obj.getProperty("id");
    FObject oldObj = getDelegate().inX(x).find(id);
    if ( id == null || oldObj == null ) return null;
    getAuthorizer().authorizeOnDelete(x, oldObj);
    return super.remove_(x, obj);
 `
    },
    {
      name: 'find_',
      javaCode: `
    if ( id == null ) return null;
    if ( getAuthorizer().checkGlobalFind(x) ) return super.find_(x, id);

    FObject obj = super.find_(x, id);
    try {
      if ( obj != null )
        getAuthorizer().authorizeOnRead(x, obj);
      return obj;
    } catch (AuthorizationException ae) {
      return null;
    }
 `
    },
    {
      name: 'select_',
      javaCode: `
    if ( ! getAuthorizer().checkGlobalRead(x, predicate) ) predicate = augmentPredicate(x, false, predicate);
    return super.select_(x, sink, skip, limit, order, predicate);
 `
    },
    {
      name: 'listen_',
      documentation: `
        A listener hears only the rows it may read.
        Each put and remove is checked with authorizeOnRead, in the listener's context.

        Why a sink, not a predicate as in select_:
        when a put fails a listen's predicate, Java PredicatedListener sends the row on as a remove.
        So a hidden row would still reach the listener. AuthorizationSink drops it.
      `,
      javaCode: `
    if ( ! getAuthorizer().checkGlobalRead(x, predicate) ) sink = new AuthorizationSink(x, getAuthorizer(), sink);
    super.listen_(x, sink, predicate);
 `
    },
    {
      name: 'removeAll_',
      javaCode: `
    if ( ! getAuthorizer().checkGlobalRemove(x) ) predicate = augmentPredicate(x, true, predicate);
    this.select_(x, new RemoveSink(x, this), skip, limit, order, predicate);
 `
    },
    {
      name: 'augmentPredicate',
      args: [
        {
          name: 'x',
          type: 'foam.lang.X'
        },
        {
          name: 'remove',
          type: 'Boolean'
        },
        {
          name: 'existingPredicate',
          type: 'Predicate'
        }
      ],
      javaType: 'Predicate',
      javaCode: `
    Predicate newPredicate = remove ? IS_AUTHORIZED_TO_DELETE(x, getAuthorizer()) : IS_AUTHORIZED_TO_READ(x, getAuthorizer());
    return existingPredicate != null ?
      AND(
        existingPredicate,
        newPredicate
      ) :
      newPredicate;
 `
  },
  {
    name: 'cmd_',
    javaCode: `
      if ( "AUTHORIZER?".equals(obj) ) {
        return getAuthorizer().getClass().getName();
      }

      return super.cmd_(x, obj);
    `
  }
  ]
});
