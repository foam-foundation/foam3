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
    'foam.lang.X',
    'foam.dao.BulkLoadDAO',
    'foam.dao.CompositeJournal',
    'foam.dao.DAO',
    'foam.dao.F3FileJournal',
    'foam.dao.Journal',
    'foam.dao.MDAO',
    'foam.dao.NullJournal',
    'foam.dao.JournalGenerations',
    'foam.dao.ReadOnlyF3FileJournal',
    'foam.dao.WriteOnlyF3FileJournal',
    'foam.core.boot.CSpec',
    'foam.core.ndiff.NDiffJournal',
    'foam.dao.compaction.CompactionCmd',
    'foam.dao.compaction.Compactor',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.List'
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
      documentation: 'Write the runtime journal multi-line. Set before delegate; passed to the journal at creation.',
      class: 'Boolean',
      name: 'multiLineOutput'
    },
    {
      documentation: `Set while this journal is compacting. Compaction rolls,
        and two concurrent rolls of one journal are not safe to interleave, so
        a second command is skipped rather than started.`,
      class: 'Object',
      name: 'compacting',
      javaType: 'java.util.concurrent.atomic.AtomicBoolean',
      javaFactory: 'return new java.util.concurrent.atomic.AtomicBoolean();'
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
                  .build());
              } else {
                setJournal(new F3FileJournal.Builder(runtimeStorageX)
                  .setDao(delegate)
                  .setFilename(getFilename())
                  .setCreateFile(false)
                  .setMultiLineOutput(getMultiLineOutput())
                  .build());
              }
            }

          Journal[] journals = null;
          if ( getRuntimeOnly() ) {
            journals = new Journal[] {
              getJournal()
            };
          } else {
            // Everything replayed ahead of the runtime journal, in order.
            List<Journal> preRuntime = new ArrayList<>();

            // Repo Journal
            preRuntime.add(new ReadOnlyF3FileJournal.Builder(getX())
              .setFilename(getFilename() + ".0")
              .build());

            // Legacy compressed journal: a hand-gzipped runtime journal from
            // before generations existed. Predates the numbering, so it sorts
            // ahead of every generation.
            String gzFilename = getFilename() + ".gz";
            if ( getX().get(foam.core.fs.FileSystemStorage.class).get(gzFilename).exists() ) {
              preRuntime.add(new ReadOnlyF3FileJournal.Builder(runtimeStorageX)
                .setFilename(gzFilename)
                .setGzip(true)
                .build());
            }

            // Generations frozen by previous cutovers, ascending, skipping
            // whatever a snapshot has superseded. Derived from the filesystem,
            // so nothing has to be remembered between runs.
            for ( String gen : new JournalGenerations(getX(), getFilename()).replayOrder() ) {
              preRuntime.add(new ReadOnlyF3FileJournal.Builder(runtimeStorageX)
                .setFilename(gen)
                .setGzip(gen.endsWith(".gz"))
                .build());
            }

            // if CSpec present in X then go through NDiff
            // (set up in EasyDAO's decorator chain)
            CSpec nspec = (CSpec)getX().get(CSpec.CSPEC_CTX_KEY);

            String cSpecName = getFilename();

            if ( nspec != null && getNdiff() ) {
              cSpecName = nspec.getName();
              List<Journal> ndiffs = new ArrayList<>();

              // replays the journals that precede the runtime journal
              for ( Journal jrl : preRuntime ) {
                ndiffs.add(new NDiffJournal.Builder(getX())
                  .setDelegate(jrl)
                  .setCSpecName(cSpecName)
                  .setRuntimeOrigin(false)
                  .build());
              }

              // replays the runtime journal
              ndiffs.add(new NDiffJournal.Builder(getX())
                .setDelegate(getJournal())
                .setCSpecName(cSpecName)
                .setRuntimeOrigin(true)
                .build());

              journals = ndiffs.toArray(new Journal[0]);
            } else {
              preRuntime.add(getJournal());
              journals = preRuntime.toArray(new Journal[0]);
            }
          }
            final Journal jnl = new CompositeJournal.Builder(getX())
              .setDelegates(journals)
              .build();

            // Replay into a plain map rather than the MDAO, so the index is
            // built from every row at once instead of one put per row. This
            // runs before the DAO is published, so nothing else can read or
            // write it while the rows are collected.
            MDAO        mdao    = delegate instanceof MDAO ? (MDAO) delegate : null;
            BulkLoadDAO staging = mdao == null ? null : new BulkLoadDAO(getX(), getOf());

            try {
              F3FileJournal runtimeJrl = getJournal() instanceof F3FileJournal ? (F3FileJournal) getJournal() : null;
              jnl.replay(getX(), staging == null ? delegate : staging);
              if ( runtimeJrl != null ) {
                String lastVersion = runtimeJrl.getLastReplayVersion();
                if ( SafetyUtil.isEmpty(lastVersion) || isCurrentVersionNewer(lastVersion, currentVersion) ) {
                  setWriteVersionOnFirstPut(true);
                }
              }
            } finally {
              // Whatever was collected before a replay threw is what the DAO
              // would have held had each row been put as it was read.
              if ( staging != null ) mdao.bulkLoad(staging.rows());
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
      // Compaction belongs to whoever owns the journal and the MDAO, which is
      // this object. Handling it here rather than from outside means a
      // partitioned DAO compacts correctly by forwarding the command to each
      // partition, instead of an orchestrator guessing which JDAO was meant.
      if ( obj instanceof CompactionCmd ) {
        new Compactor().compact(x, this, (CompactionCmd) obj);
        return obj;
      }

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
