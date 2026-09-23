/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.benchmark',
  name: 'GzipJournalReplayBenchmark',
  extends: 'foam.core.bench.Benchmark',

  documentation: `Replays one journal, plain or gzipped, to measure what
    trading disk bandwidth for inflate is worth. Two rows of this benchmark
    differing only in 'gzip' run the same reader, parse and apply path over
    the same records -- only the bytes on disk differ.

    Point 'source' at a real journal. Compression ratio is a property of the
    data, so a generated journal of User rows answers a question about User
    rows, not about production data. Generated rows are the fallback.

    Replays into a NullDAO: the read and parse stages run in full, only the
    apply stage is dropped, so heap stays flat however large the journal and
    the number isolates the read path. It is not an end-to-end boot time.

    THE RESULT IS ABOUT THE PAGE CACHE AS MUCH AS THE CODE. A gzipped journal
    is small enough to stay cached when the plain one is not, which is a real
    production effect on restart but makes a warm A/B meaningless. Drop caches
    between samples for the cold number (the first boot after a reboot), and
    run back-to-back for the warm one (a restart). Report both; they answer
    different questions.`,

  javaImports: [
    'foam.core.auth.User',
    'foam.core.bench.BenchmarkResult',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.dao.F3FileJournal',
    'foam.dao.NullDAO',
    'foam.dao.ReadOnlyF3FileJournal',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'java.io.File',
    'java.io.FileInputStream',
    'java.io.FileOutputStream',
    'java.io.InputStream',
    'java.io.OutputStream',
    'java.nio.file.Files',
    'java.nio.file.StandardCopyOption',
    'java.util.zip.GZIPOutputStream'
  ],

  javaCode: `
    protected F3FileJournal journal_;
  `,

  properties: [
    {
      documentation: 'Journal replayed by both variants. Delete it and its .gz to rebuild.',
      class: 'String',
      name: 'filename',
      value: 'gzipreplaybenchmark'
    },
    {
      documentation: `Path to an existing journal to measure. Copied in once, so
        the compression ratio and record shape are the real ones. Empty
        generates 'rowCount' User rows instead.`,
      class: 'String',
      name: 'source'
    },
    {
      documentation: 'Rows generated when no source is given. Large enough that one replay is seconds, not milliseconds.',
      class: 'Int',
      name: 'rowCount',
      value: 2000000
    },
    {
      documentation: 'Replay the gzipped copy rather than the plain journal.',
      class: 'Boolean',
      name: 'gzip'
    }
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x, BenchmarkResult br',
      javaCode: `
        var storage = (FileSystemStorage) x.get(FileSystemStorage.class);
        File plain   = storage.get(getFilename());
        File zipped  = storage.get(getFilename() + ".gz");

        // Built once and reused by both variants, so each measures the same
        // records. A run that died mid-write leaves a short file behind --
        // delete both files to rebuild.
        try {
          if ( ! plain.exists() || plain.length() == 0 ) buildJournal(x, plain);
          if ( getGzip() && ( ! zipped.exists() || zipped.length() == 0 ) ) compress(plain, zipped);
        } catch ( java.io.IOException e ) {
          throw new RuntimeException(e);
        }

        if ( getGzip() ) {
          Loggers.logger(x, this).info("journal", plain.length(), "gz", zipped.length(),
            "ratio", String.format("%.1fx", (double) plain.length() / Math.max(1, zipped.length())));
        }

        // Benchmarks boot with -Dresource.journals.dir set, so Storage is the
        // ResourceStorage over the jar. Read through the FileSystemStorage, as
        // JDAO does for the runtime journal, or the reader looks in the jar and
        // replay returns having found nothing.
        X runtimeX = x.put(Storage.class, storage);

        journal_ = new ReadOnlyF3FileJournal.Builder(runtimeX)
          .setFilename(getGzip() ? getFilename() + ".gz" : getFilename())
          .setGzip(getGzip())
          .build();
        journal_.setX(runtimeX);
      `
    },
    {
      name: 'buildJournal',
      args: 'X x, File plain',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        if ( ! SafetyUtil.isEmpty(getSource()) ) {
          Files.copy(new File(getSource()).toPath(), plain.toPath(), StandardCopyOption.REPLACE_EXISTING);
          return;
        }

        DAO sink = new NullDAO(x, User.getOwnClassInfo());
        F3FileJournal out = new F3FileJournal.Builder(x)
          .setFilename(getFilename())
          .setCreateFile(true)
          .build();
        out.setX(x);

        for ( int i = 0 ; i < getRowCount() ; i++ ) {
          User u = new User();
          u.setId(i);
          u.setFirstName("first" + i);
          u.setLastName("last" + i);
          u.setEmail("user" + i + "@example.com");
          out.put(x, "", sink, u);
        }
        out.getWriter().flush();
      `
    },
    {
      name: 'compress',
      args: 'File plain, File zipped',
      javaThrows: [ 'java.io.IOException' ],
      javaCode: `
        try (
          InputStream  is = new FileInputStream(plain);
          OutputStream os = new GZIPOutputStream(new FileOutputStream(zipped), 64 * 1024)
        ) {
          byte[] buffer = new byte[1024 * 1024];
          for ( int n ; ( n = is.read(buffer) ) > 0 ; ) os.write(buffer, 0, n);
        }
      `
    },
    {
      name: 'execute',
      args: 'X x',
      javaCode: `
        journal_.replay(x, new NullDAO(x, User.getOwnClassInfo()));
      `
    }
  ]
});
