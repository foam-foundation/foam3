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
    'foam.core.ndiff.NDiffJournal'
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
      documentation: 'Perform replay synchronously. Manual workaround for deadlock with AsyncAssemblyLine',
      class: 'Boolean',
      name: 'syncReplay',
      value: true
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
      name: 'delegate',
      class: 'foam.dao.DAOProperty',
      javaFactory: 'return new MDAO(getOf());',
      javaPostSet: `
            var delegate = val;

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
              jnl.replay(getX(), delegate);
            } else {
              final String name = getFilename();
              Agency agency = (Agency) getX().get("threadPool");
              agency.submit(getX(), new ContextAgent() {
                public void execute(X x) {
                  jnl.replay(getX(), delegate);
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
    }
  ]
});
