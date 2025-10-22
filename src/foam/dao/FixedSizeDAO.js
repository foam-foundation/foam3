/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'FixedSizeDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `
    Manages the size of a dao by purging on each put. Elements that match
    the predicate are removed.
    NOTE: this DAO must delegate to an MDAO so the remove operations only
    affect memory.  Install via EasyDAO to it is installed in the correct
    place.`,

  javaImports: [
    'foam.dao.DAO',
    'foam.mlang.sink.Count'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.order.Comparator',
      name: 'comparator'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'predicate',
      javaFactory: 'return foam.mlang.MLang.TRUE;'
    },
    {
      class: 'Int',
      name: 'size'
    },
    {
      class: 'Long',
      name: 'purgePercent',
      value: 10
    }
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
        obj = getDelegate().put_(x, obj);

        // Short-circuit return to avoid unneeded count and removeAll walks
        if ( ! getPredicate().f(obj) ) return obj;

        Count count = new Count();
        count = (Count) this.getDelegate().select(count);

        // Trim data e.g, on MDAO, to fit the FixedSizeDAO
        if ( count.getValue() > getSize() + getSize() * getPurgePercent() / 100 ) {
          DAO delegate = this.getDelegate()
            .where(getPredicate())
            .skip(getSize());

          if ( getComparator() != null ) {
            delegate = delegate.orderBy(getComparator());
          }

          delegate.removeAll();
        }
        return obj;
      `
    },
    {
      name: 'cmd_',
      javaCode: `
      if ( DAO.PURGE_CMD.equals(obj) ) {
        getDelegate().removeAll();
      }
      return getDelegate().cmd_(x, obj);
      `
    }
  ]
});
