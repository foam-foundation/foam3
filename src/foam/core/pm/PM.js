/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.pm',
  name: 'PM',

  documentation: 'A Performance Measure which captures the count and duration of some event.',

  implements: [
    'foam.core.analytics.Foldable',
    'foam.core.ruler.RuleAction'
  ],

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.DAO',
    'static foam.mlang.MLang.EQ'
  ],

  constants: [
    {
      type: 'ThreadLocal',
      name: 'local__',
      javaValue: `
        new ThreadLocal() {
          protected Object initialValue() {
            return new int[] { 0 };
          }
        }
      `
    }
  ],

  ids: [ 'key', 'name', 'startTime' ],

  properties: [
    {
      class: 'String',
      name: 'key'
    },
    {
      class: 'String',
      name: 'name'
    },
    {
      name: 'startTime',
      documentation: 'Start time of PM in milliseconds',
      class: 'Long',
      factory: function() {
        return Date.now();
      },
      javaFactory: `return System.currentTimeMillis();`
    },
    {
      name: 'endTime',
      documentation: 'End time of PM in milliseconds',
      class: 'Long'
    },
    {
      name: 'isError',
      class: 'Boolean',
      value: false,
      documentation: 'When true it marks this PM as already having been logged, subsequent logs with be ignored'
    },
    {
      name: 'errorMessage',
      class: 'String'
    },
    {
      name: 'exception',
      class: 'Object',
      storageTransient: true
    },
    {
      name: 'enableCandlestick',
      class: 'Boolean',
      documentation: 'Whether to create a candlestick for this PM.'
    },
    {
      class: 'Boolean',
      name: 'enableLogging',
      documentation: 'If enabled, information is output to stderr to aid with tracing. Is taken from PMFactory.'
    }
  ],

  methods: [
    {
      name: 'init_',
      javaCode: `
        if ( getEnableLogging() ) {
          int[] countPtr = (int[]) local__.get();
          countPtr[0]++;
          int count = countPtr[0];
          System.err.printf("thread:%5d depth:%3d %s %s:%s", Thread.currentThread().getId(), count, " ".repeat(count), getKey(), getName());
          System.err.println();
        }

        getStartTime();
      `
    },
    {
      name: 'log',
      type: 'Void',
      args: [
        {
          name: 'x',
          type: 'X'
        }
      ],
      javaCode: `
        if ( getEnableLogging() ) {
          int[] countPtr = (int[]) local__.get();
          countPtr[0]--;
        }

        if ( x == null ) return;
        if ( getIsError() ) return;
        if ( getEndTime() == 0L ) {
          setEndTime(System.currentTimeMillis());
        }
        PMLogger pmLogger = (PMLogger) x.get(DAOPMLogger.SERVICE_NAME);
        if ( pmLogger != null ) {
          pmLogger.log(this);
        }

        // Candlestick
        if ( getEnableCandlestick() ) {
          DAOPMLogger daoPMLogger = (DAOPMLogger) x.get("daoPMLogger");
          if ( daoPMLogger != null ) {
            daoPMLogger.log(this);
          }
        }
      `
    },
    {
      name: 'getTime',
      type: 'Long',
      javaCode: `
      if ( getEndTime() == 0 ) {
        return System.currentTimeMillis() - getStartTime();
      } else {
        return getEndTime() - getStartTime();
      }
      `
    },
    {
      name: 'doFolds',
      javaCode: `
    fm.foldForState(getKey()+":"+getName(), new java.util.Date(getStartTime()), getTime());
      `
    },
    {
      name: 'error',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'args', type: 'Object...' }
      ],
      javaCode: `
        if ( getEnableLogging() ) {
          int[] countPtr = (int[]) local__.get();
          countPtr[0]--;
        }

        setIsError(true);
        setEndTime(System.currentTimeMillis());
        StringBuilder sb = new StringBuilder();
        for (Object obj: args) {
          if ( obj instanceof Exception ) {
            setException(obj);
            sb.append(((Exception) obj).getMessage());
          } else {
            sb.append(obj);
          }
          sb.append(",");
        }
        if ( sb.length() > 0 ) {
          setErrorMessage(sb.deleteCharAt(sb.length() - 1).toString());
        }
        PMLogger pmLogger = (PMLogger) x.get(DAOPMLogger.SERVICE_NAME);
        if ( pmLogger != null ) {
          pmLogger.log(this);
        } else {
          System.err.println("PMLogger not found.");
          new Exception("PMLogger not found").printStackTrace();
        }
        `
    },
    {
      name: 'applyAction',
      javaCode: `
          agency.submit(x, new ContextAgent() {
            @Override
            public void execute(X x) {
              PM pm = (PM) obj;
              if ( ! pm.getIsError() )
                return;
            }
          }, "PM alarm");
     `
    }
  ],
  javaCode: `
    public static PM create(X x, FObject fo, String... name) {
      PM pm = (PM) x.get("PM");

      if ( pm == null ) return new PM(fo, name);

      pm.setKey(fo.getClassInfo().getId());
      pm.setName(combine((Object[]) name));
      pm.init_();

      return pm;
    }

    public static PM create(X x, ClassInfo clsInfo, String... name) {
      PM pm = (PM) x.get("PM");

      if ( pm == null ) return new PM(clsInfo, name);

      pm.setKey(clsInfo.getId());
      pm.setName(combine((Object[]) name));
      pm.init_();

      return pm;
    }

    public static PM create(X x, Class cls, Object... args) {
      return create(x, cls.getName(), args);
    }

    public static PM create(X x, Object key, Object... args) {
      PM pm = (PM) x.get("PM");

      if ( pm == null ) return new PM(key, args);

      pm.setKey(key.toString());
      pm.setName(combine((Object[]) args));
      pm.init_();

      return pm;
    }

    public static PM create(X x, Boolean enableCandlestick, String... args) {
      PM pm = new PM(args);
      pm.setEnableCandlestick(enableCandlestick);
      return pm;
    }

    public PM(ClassInfo clsInfo, String... name) {
      setName(combine((Object[]) name));
      setKey(clsInfo.getId());
      init_();
    }

    public PM(Class cls, String... name) {
      setName(combine((Object[]) name));
      foam.lang.ClassInfoImpl clsInfo = new foam.lang.ClassInfoImpl();
      clsInfo.setObjClass(cls);
      clsInfo.setId(cls.getName());
      setKey(clsInfo.getId());
      init_();
    }

    public PM(FObject fo, String... name) {
      this(fo.getClassInfo(), name);
    }

    public PM(String... args) {
      if ( args.length > 0 ) {
        setKey(args[0]);
      }
      if ( args.length > 1 ) {
        setName(combine((Object[]) java.util.Arrays.copyOfRange(args, 1, args.length)));
      }
      init_();
    }

    public PM(Object... args) {
      if ( args.length > 0 ) {
        setKey(args[0].toString());
      }
      if ( args.length > 1 ) {
        setName(combine((Object[]) java.util.Arrays.copyOfRange(args, 1, args.length)));
      }
      init_();
    }

    public static String combine(Object... args) {
      if ( args == null ) return "";
      if ( args.length == 0 || args[0] == null ) return "";
      if ( args.length == 1 ) return args[0].toString();
      StringBuilder sb = new StringBuilder();
      for ( Object o: args) {
        if ( o instanceof FObject ) {
          sb.append(o.getClass().getSimpleName());
        } else {
          sb.append(o);
        }
        sb.append(":");
      }
      return sb.deleteCharAt(sb.length() - 1).toString();
    }
  `
});
