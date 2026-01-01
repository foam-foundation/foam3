/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.util',
  name: 'NUIDGenerator',
  extends: 'foam.util.UIDGenerator',
  flags: ['java'],

  documentation: 'Numeric unique ID generator',

  javaImports: [
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.lang.PropertyInfo',
    'foam.dao.AbstractSink',
    'foam.dao.DAO',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'static foam.util.UIDSupport.*',
    'java.util.concurrent.atomic.AtomicLong',
    'java.util.concurrent.atomic.AtomicBoolean'
  ],

  javaCode: `
  public NUIDGenerator(X x, String salt, DAO dao, PropertyInfo pInfo) {
    setX(x);
    setDao(dao);
    setSalt(salt);
    setPropertyInfo(pInfo);
    init_();
  }

  AtomicLong seqNo_ = new AtomicLong();
  AtomicBoolean initMaxSeqNo_ = new AtomicBoolean(false);
  `,

  properties: [
    {
      class: 'String',
      name: 'salt',
      javaPostSet: 'if ( getDao() == null ) setDao((DAO) getX().get(getSalt()));'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao'
    },
    {
      class: 'FObjectProperty',
      name: 'propertyInfo',
      hidden: true,
      javaType: 'foam.lang.PropertyInfo',
      javaInfoType: 'foam.lang.AbstractObjectPropertyInfo'
    }
  ],

  methods: [
    {
      name: 'init_',
      javaCode: 'assertLongId();'
    },
    {
      name: 'getNext',
      args: [ 'java.lang.Class type' ],
      type: 'Object',
      javaCode: 'return getNextLong();'
    },
    {
      name: 'generate_',
      documentation: `
        Generate numeric unique ID based on last seqNo:
        at least 2 hexits sequence number + 2 hexits machine ID + 3 hexits checksum.

        The generated NUID should be at least 7 hex digits long thus larger than
        0x1000000.
      `,
      javaCode: `
        // At least 2 bits sequence number
        initMaxSeqNo();
        id.append(toHexString(seqNo_.incrementAndGet(), 2));
      `
    },
    {
      name: 'initMaxSeqNo',
      javaCode: `
      if ( ! initMaxSeqNo_.get() ) {
        synchronized ( initMaxSeqNo_ ) {
          if ( ! initMaxSeqNo_.get() ) {
            Logger logger = Loggers.logger(getX(), this);
            logger.info(getSalt(), "max", "find");
            getDao().select(new AbstractSink() {
              @Override
              public void put(Object obj, Detachable sub) {
                var id = (long) getPropertyInfo().get(obj);
                maybeUpdateSeqNo(id);
              }
              public void eof() {
                initMaxSeqNo_.getAndSet(true);
              }
            });
            Loggers.logger(getX(), this).info(getSalt(), "max", "found", seqNo_.get());
          }
        }
      }
      `
    },
    {
      name: 'assertLongId',
      javaThrows: [ 'java.lang.UnsupportedOperationException' ],
      javaCode: `
        if ( ! ( getPropertyInfo() instanceof foam.lang.AbstractLongPropertyInfo ) ) {
          throw new UnsupportedOperationException(
            "NUIDGenerator: not supported on " + getSalt() + " without id property");
        }
      `
    },
    {
      name: 'maybeUpdateSeqNo',
      args: 'Long id',
      javaCode: `
        if ( id > 0x1000000 ) {
          if ( UIDSupport.hash(id) != getHashKey() ) {
            Loggers.logger(getX(), this).warning(getSalt(), "id:" + id, "hash not matched");
            return;
          }

          var hex   = undoPermute(Long.toHexString(id));
          var mid   = Integer.parseInt(hex.substring(hex.length() - 5, hex.length() - 3), 16);
          if ( getMachineId() % 0xff == mid ) {
            var seqNo = Integer.parseInt(hex.substring(0, hex.length() - 5), 16);
            seqNo_.getAndAccumulate(seqNo, (old, nu) -> Math.max(old, nu));
          }
        }
      `
    }
  ]
});
