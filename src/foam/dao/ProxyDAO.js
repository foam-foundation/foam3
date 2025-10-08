/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'ProxyDAO',
  extends: 'foam.dao.AbstractDAO',

  requires: [
    'foam.dao.NullDAO',
    'foam.dao.ProxyListener',
  ],

  documentation: 'Proxy implementation for the DAO interface.',

  properties: [
    {
      class: 'Proxy',
      of: 'foam.dao.DAO',
      name: 'delegate',
      forwards: [ 'put_', 'remove_', 'find_', 'select_', 'removeAll_', 'listen_' ],
      topics: [ 'on' ], // TODO: Remove this when all users of it are updated.
      factory: function() { return this.NullDAO.create() },
      postSet: function(old, nu) {
        if ( old ) this.on.reset.pub();
      },
      swiftFactory: 'return NullDAO_create()',
      swiftPostSet: `
if let oldValue = oldValue as? foam_dao_AbstractDAO {
  _ = oldValue.on["reset"].pub()
}
      `,
    },
    {
      name: 'of',
      expression: function(delegate) {
        return delegate.of || null;
      },
      swiftExpressionArgs: ['delegate$of'],
      swiftExpression: 'return delegate$of as! ClassInfo',
      javaFactory: `return getDelegate().getOf();`
    }
  ],

  methods: [
    {
      name: 'cmd_',
      code: function cmd_(x, obj) {
        return this.delegate.cmd_(x, obj);
      },
      javaCode: `
        Object ret = super.cmd_(x, obj);
        if ( ret != null ) return ret;
        return getDelegate().cmd_(x, obj);
      `
    },
    {
      name: 'listen_',
      code: function listen_(context, sink, predicate) {
        var listener = this.ProxyListener.create({
          delegate: sink,
          predicate: predicate,
          dao: this
        }, context);

        listener.onDetach(this.sub('propertyChange', 'delegate', listener.update));
        // This seems wrong but now things break without it.
        listener.update();

        return listener;
      },
      swiftCode: `
let listener = ProxyListener_create([
  "delegate": sink,
  "predicate": predicate
], x)

listener.onDetach(listener.dao$.follow(delegate$))

return listener
      `,
      javaCode: `
        // TODO: Support changing of delegate
        // TODO: Return a detachable
        getDelegate().listen_(getX(), sink, predicate);
      `
    },
    {
      name: 'fclone',
      type: 'FObject',
      javaCode: `
        return this;
      `
    }
  ],

  axioms: [
    {
      buildJavaClass: function(cls) {
        cls.extras.push(`
  public ProxyDAO(foam.lang.X x, foam.dao.DAO delegate) {
    setX(x);
    setDelegate(delegate);
  }

  public ProxyDAO(foam.lang.X x, foam.lang.ClassInfo of, foam.dao.DAO delegate) {
    setX(x);
    setOf(of);
    setDelegate(delegate);
  }
        `);
      }
    }
  ]
});
