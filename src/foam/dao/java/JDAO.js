/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.java',
  name: 'JDAO',
  extends: 'foam.dao.ProxyDAO',
  flags: ['java'],

  documentation: `Implements a Journal DAO - a file based DAO.
In this current implementation setDelegate must be called last.`,

  javaImports: [
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.dao.CompositeJournal',
    'foam.dao.DAO',
    'foam.dao.F3FileJournal',
    'foam.dao.Journal',
    'foam.dao.MDAO',
    'foam.dao.NullJournal',
    'foam.dao.ReadOnlyF3FileJournal',
    'foam.dao.WriteOnlyF3FileJournal',
    'foam.core.boot.CSpec',
    'foam.core.ndiff.NDiffJournal',
    'foam.util.SafetyUtil'
  ],

  javaCode: `
    // TODO: These convenience constructors should be removed and done using the facade pattern.
    public JDAO(X x, foam.lang.ClassInfo classInfo, String filename) {
      this(x, new MDAO(classInfo), filename, false);
    }

    public JDAO(X x, DAO delegate, String filename) {
      this(x, delegate, filename, false);
    }

    public JDAO(X x, DAO delegate, String filename, Boolean cluster) {
      setX(x);
      setOf(delegate.getOf());
      setFilename(filename);
      setCluster(cluster);
      setDelegate(delegate);
    }
  `,

  properties: [
    {
      name: 'filename',
      class: 'String'
    },
    {
      name: 'cluster',
      class: 'Boolean',
      value: false
    },
    {
      class: 'FObjectProperty',
      of: 'foam.dao.Journal',
      name: 'journal'
    },
    {
      documentation: 'See F3FileJournal. Default journal replay is asynchronous. Some models with business logic that reference self can cause deadlock when parsed out of order.  If journal processing hangs, set syncReplay to true to replay synchronously.',
      class: 'Boolean',
      name: 'syncReplay'
    },
    {
      documentation: `Force caller to wait on nspec initailzation. The first call to 'get' for an nspec (x.get(servicename)) will have the calling thread wait on reply of service. This is the default behaviour and should be used for all essential services.  Also this should be used if the model is using SeqNo or NUID for id generation.`,
      class: 'Boolean',
      name: 'waitReplay',
      value: true
    },
    {
      documentation: 'Filesystem is read-only, journals updates are factilitated through some other means such as medusa.',
      class: 'Boolean',
      name: 'readOnly',
      javaFactory: 'return "ro".equals(System.getProperty("FS", "rw"));'
    },
    {
      documentation: 'Only load the runtime generated journal file.  Used by Medusa to bootstrap a system with existing data.',
      class: 'Boolean',
      name: 'runtimeOnly',
      value: false
    },
    {
      documentation: `Enable NDiff in JDAO. Enable per DAO with this property or globally via JVM Parameter 'UseNDiff', see EasyDAO.ndiff`,
      class: 'Boolean',
      name: 'ndiff'
    },
    {
      class: 'String',
      name: 'version',
      javaFactory: `
        version_ = foam.core.app.AppConfig.class.getPackage().getImplementationVersion();
        if ( ! SafetyUtil.isEmpty(version_) )
          return version_;
        return "";
      `
    },
    {
      class: 'Boolean',
      name: 'writeVersionOnFirstPut'
    },
    {
      name: 'delegate',
      javaFactory: 'return new MDAO(getOf());',
      javaPostSet: `
            var delegate = val;
            var currentVersion = getVersion();

            // Runtime Journal
            X runtimeStorageX = getX().put(foam.core.fs.Storage.class, getX().get(foam.core.fs.FileSystemStorage.class));
            if ( getCluster() ) {
              setJournal(new NullJournal.Builder(runtimeStorageX).build());
            } else {
              if ( getReadOnly() ) {
                setJournal(new ReadOnlyF3FileJournal.Builder(runtimeStorageX)
                  .setDao(delegate)
                  .setFilename(getFilename())
                  .setCreateFile(true)
                  .setSyncReplay(getSyncReplay())
                  .build());
              } else {
                setJournal(new F3FileJournal.Builder(runtimeStorageX)
                  .setDao(delegate)
                  .setFilename(getFilename())
                  .setCreateFile(false)
                  .setSyncReplay(getSyncReplay())
                  .build());
              }
            }

          Journal[] journals = null;
          if ( getRuntimeOnly() ) {
            journals = new Journal[] {
              getJournal()
            };
          } else {
            // Repo Journal
            F3FileJournal journal0 = new ReadOnlyF3FileJournal.Builder(getX())
              .setFilename(getFilename() + ".0")
              .build();

            // if CSpec present in X then go through NDiff
            // (set up in EasyDAO's decorator chain)
            CSpec nspec = (CSpec)getX().get(CSpec.NSPEC_CTX_KEY);

            String cSpecName = getFilename();

            if ( nspec != null &&
                 getNdiff() ) {
              cSpecName = nspec.getName();
              journals = new Journal[] {
                // replays the repo journal
                new NDiffJournal.Builder(getX())
                .setDelegate(journal0)
                .setCSpecName(cSpecName)
                .setRuntimeOrigin(false)
                .build(),

                // replays the runtime journal
                new NDiffJournal.Builder(getX())
                .setDelegate(getJournal())
                .setCSpecName(cSpecName)
                .setRuntimeOrigin(true)
                .build()
              };
            } else {
              journals = new Journal[] {
                journal0,
                getJournal()
              };
            }
          }
            final Journal jnl = new CompositeJournal.Builder(getX())
              .setDelegates(journals)
              .build();

            if ( getWaitReplay() ) {
              // Speedup replay to MDAOs by disabling safe mode which clones
              // the incoming object for safety, but isn't needed here.
              try { ((MDAO) delegate).setSafeMode(false); } catch (Throwable t) {}
              try {
                F3FileJournal runtimeJrl = getJournal() instanceof F3FileJournal ? (F3FileJournal) getJournal() : null;
                jnl.replay(getX(), delegate);
                if ( runtimeJrl != null ) {
                  String lastVersion = runtimeJrl.getLastReplayVersion();
                  if ( SafetyUtil.isEmpty(lastVersion) || isCurrentVersionNewer(lastVersion, currentVersion) ) {
                    setWriteVersionOnFirstPut(true);
                  }
                }
              } finally {
                try { ((MDAO) delegate).setSafeMode(true); } catch (Throwable t) {}
              }
            } else {
              final String name = getFilename();
              F3FileJournal runtimeJrl = getJournal() instanceof F3FileJournal ? (F3FileJournal) getJournal() : null;
              Agency agency = (Agency) getX().get("threadPool");
              agency.submit(getX(), new ContextAgent() {
                public void execute(X x) {
                  jnl.replay(getX(), delegate);
                  if ( runtimeJrl != null ) {
                    String lastVersion = runtimeJrl.getLastReplayVersion();
                    if ( SafetyUtil.isEmpty(lastVersion) || isCurrentVersionNewer(lastVersion, currentVersion) ) {
                      runtimeJrl.writeVersion(x, currentVersion);
                    }
                  }
                }
              }, this.getClass().getSimpleName()+"-replay");
            }
    `
    }
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
        if ( getWriteVersionOnFirstPut() ) {
          ((F3FileJournal) getJournal()).writeVersion(getX(), getVersion());
          setWriteVersionOnFirstPut(false);
        }
        return getJournal().put(x, "", getDelegate(), obj);
      `
    },
    {
      name: 'remove_',
      javaCode: `
        return getJournal().remove(x, "", getDelegate(), obj);
      `
    },
    {
      name: 'removeAll_',
      javaCode: `
        super.select_(x, new foam.dao.RemoveSink(x, this), skip, limit, order, predicate);
      `
    },
    {
      name: 'cmd_',
      javaCode: `
      Object result = getJournal().cmd(x, obj);
      if ( result != null ) return result;
      return getDelegate().cmd_(x, obj);
      `
    },
    {
      documentation: 'compare versions, disregard build timestamp',
      name: 'isCurrentVersionNewer',
      args: 'String last, String current',
      type: 'Boolean',
      javaCode: `
        if ( SafetyUtil.isEmpty(current) ) return false;
        String[] lastArr = last.split("-")[0].split("\\\\.");
        String[] currentArr = current.split("-")[0].split("\\\\.");
        for ( int i = 0; i < Math.max(lastArr.length, currentArr.length); i++ ) {
          int last_i = i < lastArr.length ? Integer.parseInt(lastArr[i]) : 0;
          int current_i = i < currentArr.length ? Integer.parseInt(currentArr[i]) : 0;
          if ( last_i == current_i ) continue;
          return current_i > last_i;
        }
        return false;
      `
    }
  ]
});
