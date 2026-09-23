/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'AbstractF3FileJournal',
  abstract: true,
  flags: ['java'],

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.ProxyX',
    'foam.lang.X',
    'foam.lang.AbstractFObjectPropertyInfo',
    'foam.lib.formatter.JSONFObjectFormatter',
    'foam.lib.json.ExprParser',
    'foam.lib.json.JSONParser',
    'foam.lib.parse.*',
    'foam.lib.StoragePropertyPredicate',
    'foam.core.app.AppConfig',
    'foam.core.auth.LastModifiedByAware',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.logger.PrefixLogger',
    'foam.core.logger.StdoutLogger',
    'foam.core.om.OMLogger',
    'foam.core.pm.PM',
    'foam.util.SafetyUtil',
    'java.io.BufferedInputStream',
    'java.io.BufferedReader',
    'java.io.BufferedWriter',
    'java.io.File',
    'java.io.IOException',
    'java.io.InputStream',
    'java.io.InputStreamReader',
    'java.io.OutputStream',
    'java.io.OutputStreamWriter',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.StandardCopyOption',
    'java.time.format.DateTimeFormatter',
    'java.time.LocalDateTime',
    'java.util.Calendar',
    'java.util.Iterator',
    'java.util.List',
    'java.util.regex.Pattern',
    'java.util.TimeZone',
    'java.util.zip.GZIPInputStream',
    'java.util.zip.GZIPOutputStream'
  ],

  javaCode: `
    protected static Pattern COMMENT = Pattern.compile("(/\\\\*([^*]|[\\\\r\\\\n]|(\\\\*+([^*/]|[\\\\r\\\\n])))*\\\\*+/)|(//.*)");

    protected static ThreadLocal<JSONFObjectFormatter> formatter = new ThreadLocal<JSONFObjectFormatter>() {
      @Override
      protected JSONFObjectFormatter initialValue() {
        JSONFObjectFormatter b = new JSONFObjectFormatter();
        b.setPropertyPredicate(new StoragePropertyPredicate());
        b.setOutputShortNames(true);
        b.setOutputDefaultClassNames(false);
        return b;
      }
      @Override
      public JSONFObjectFormatter get() {
        JSONFObjectFormatter b = super.get();
        b.reset();
        return b;
      }
    };

    protected JSONFObjectFormatter getFormatter(X x) {
      JSONFObjectFormatter f = formatter.get();
      f.setX(x);
      f.setMultiLine(getMultiLineOutput());
      return f;
    }

    protected static ThreadLocal<StringBuilder> sb = new ThreadLocal<StringBuilder>() {
      @Override
      protected StringBuilder initialValue() {
        return new StringBuilder();
      }
      @Override
      public StringBuilder get() {
        StringBuilder b = super.get();
        b.setLength(0);
        return b;
      }
    };

    // used for reading, and is shared across threads
    protected StringBuilder stringBuilder = new StringBuilder();

    protected static ThreadLocal<foam.lib.json.JSONParser> jsonParser = new ThreadLocal<foam.lib.json.JSONParser>() {
      @Override
      protected foam.lib.json.JSONParser initialValue() {
        return new JSONParser();
      }
      @Override
      public foam.lib.json.JSONParser get() {
        foam.lib.json.JSONParser parser = super.get();
        return parser;
      }
    };

    protected foam.lib.json.JSONParser getParser(X x) {
      foam.lib.json.JSONParser p = jsonParser.get();
      p.setX(x);
      return p;
    }

    // Bytes read from disk per read() during replay. Large on purpose: replay
    // parsing runs concurrently off the reader thread, so a stall here idles
    // cores, and the buffer is freed as soon as the replay closes the reader.
    final static public int READ_BUFFER_SIZE    = 4 * 1024 * 1024;

    // Compressed bytes GZIPInputStream pulls per inflate refill. In memory, off
    // the buffer above, so it only has to be big enough that the per-refill cost
    // disappears -- and small enough not to bypass that buffer.
    final static public int INFLATE_BUFFER_SIZE = 64 * 1024;

    final static public char OP_CREATE  = 'c';
    final static public char OP_PUT     = 'p';
    final static public char OP_REMOVE  = 'r';
    final static public char OP_VERSION = 'v';
  `,

  constants: [
    {
      name: 'MODIFIED_BY',
      type: 'String',
      value: '// Modified by '
    },
    {
      name: 'OPEN_CREATE',
      type: 'String',
      value: 'c({'
    },
    {
      name: 'OPEN_PUT',
      type: 'String',
      value: 'p({'
    },
    {
      name: 'OPEN_REMOVE',
      type: 'String',
      value: 'r({'
    },
    {
      name: 'OPEN_VERSION',
      type: 'String',
      value: 'v({'
    },
    {
      name: 'CLOSE',
      type: 'String',
      value: '})'
    },
    {
      name: 'OP_OPEN',
      type: 'String',
      value: '('
    },
    {
      name: 'OP_CLOSE',
      type: 'String',
      value: ')'
    }
  ],

  properties: [
    {
      class: 'Object',
      name: 'line',
      javaType: 'foam.util.concurrent.AssemblyLine',
      javaFactory: 'return new foam.util.concurrent.SyncAssemblyLine(getX());'
    },
    {
      class: 'Object',
      name: 'timeStamper',
      javaType: 'foam.util.FastTimestamper',
      javaFactory: `return new foam.util.FastTimestamper();`
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.logger.Logger',
      name: 'logger',
      javaFactory: `
        Logger logger = (Logger) getX().get("logger");
        if ( logger == null ) {
          logger = StdoutLogger.instance();
        }
        return new PrefixLogger(new Object[] { "Journal", getFilename() }, logger);
      `,
      javaCloneProperty: '//noop'
    },
    {
      class: 'String',
      name: 'filename',
      required: true
    },
    {
      class: 'Boolean',
      name: 'multiLineOutput',
      value: false
    },
    {
      class: 'Boolean',
      name: 'createFile',
      documentation: 'Flag to create file if not present',
      value: true,
    },
    {
      class: 'Boolean',
      name: 'gzip',
      documentation: `Journal file is gzip compressed: the replay stream is
        decompressed and the write stream compressed.

        A compressed writer must be closed, not merely flushed, or the gzip
        trailer is never written and the file will not read back. That suits a
        write-once journal such as a compaction snapshot; it is not safe for a
        live journal, which is flushed and never closed.`
    },
    {
      documentation: 'Bytes the current replay has read from the journal, against the file size for a progress percentage. Reset when a new reader is opened.',
      class: 'Object',
      name: 'replayBytesRead',
      javaType: 'java.util.concurrent.atomic.AtomicLong',
      javaFactory: 'return new java.util.concurrent.atomic.AtomicLong();'
    },
    // reader uses a getter because we want a new reader on file replay
    {
      class: 'Object',
      name: 'reader',
      javaType: 'java.io.BufferedReader',
      javaGetter: `
try {
  InputStream is = getX().get(Storage.class).getInputStream(getFilename());
  if ( is == null ) {
    getLogger().warning("File not found", "for reading");
    return null;
  }
  // Batch the disk reads. Everything above this reads in small slices --
  // StreamDecoder pulls 8K at a time into a byte buffer that InputStreamReader
  // gives no way to size, and GZIPInputStream pulls its input buffer's worth --
  // so without this the file is read from disk 8K at a time however large the
  // BufferedReader below is. Sitting under the counter and the replay stream
  // decorator, it keeps their progress smooth: they see bytes as they are
  // consumed, while the disk sees READ_BUFFER_SIZE reads.
  is = new BufferedInputStream(is, READ_BUFFER_SIZE);
  is = decorateReplayStream(is);
  final java.util.concurrent.atomic.AtomicLong bytesRead = getReplayBytesRead();
  bytesRead.set(0);
  is = new java.io.FilterInputStream(is) {
    public int read() throws IOException {
      int b = super.read();
      if ( b != -1 ) bytesRead.incrementAndGet();
      return b;
    }
    public int read(byte[] buf, int off, int len) throws IOException {
      int n = super.read(buf, off, len);
      if ( n > 0 ) bytesRead.addAndGet(n);
      return n;
    }
  };
  // Decompress outside the counter, so the bytes counted are the compressed
  // ones the file's length is measured in. The size argument is GZIPInputStream's
  // *input* buffer -- how much compressed data it pulls per inflate refill, not
  // decompressed output, which it inflates straight into the reader's array.
  // Deliberately well under READ_BUFFER_SIZE: BufferedInputStream hands a read
  // of its own buffer size or larger straight to the file, so a bigger value
  // here would turn the buffering below back into pass-through.
  if ( getGzip() ) is = new GZIPInputStream(is, INFLATE_BUFFER_SIZE);
  // Setting a larger buffer size increases performance by 10-15%
  return new BufferedReader(new InputStreamReader(is), 1024 * 1024 * 8);
} catch ( Throwable t ) {
  getLogger().error("Failed to initialize reader", t);
  throw new RuntimeException(t);
}
      `
    },
    // Writer uses a factory because we want to use one writer for the lifetime of this journal object
    {
      class: 'Object',
      name: 'writer',
      javaType: 'java.io.BufferedWriter',
      javaFactory: `
try {
  OutputStream os = getX().get(FileSystemStorage.class).getOutputStream(getFilename());
  if ( os == null ) {
    getLogger().warning("File not found", "for writing");
    return null;
  }
  // See the gzip property: the caller owns closing this, or the trailer never
  // lands and the file cannot be replayed.
  if ( getGzip() ) os = new GZIPOutputStream(os, INFLATE_BUFFER_SIZE);
  return new BufferedWriter(new OutputStreamWriter(os));
} catch ( Throwable t ) {
  getLogger().error("Failed to initialize writer", t);
  throw new RuntimeException(t);
}
      `
    },
    {
      class: 'Long',
      name: 'lastUser'
    },
    {
      class: 'Long',
      name: 'lastTimestamp'
    },
    {
      class: 'Long',
      name: 'commentWindowMs',
      documentation: `How close two writes by one user have to be for the second
        to reuse the first one's attribution comment.

        Zero compares exact milliseconds, so only a same-instant burst shares a
        comment. A larger window trades attribution lines for a smaller journal,
        which is worth setting where the comment is written for every operation
        rather than only for records that carry no lastModifiedBy of their own.`
    }
  ],

  methods: [
    {
      name: 'decorateReplayStream',
      documentation: `Extension point: wrap the InputStream a replay reads
        from (progress counting, decompression, ...). NOP by default --
        override or refine to install a wrapper (see
        foam.core.partition.F3FileJournalRefinement).`,
      args: 'java.io.InputStream is',
      type: 'java.io.InputStream',
      javaCode: 'return is;'
    },
    {
      name: 'writeVersion',
      type: 'Void',
      args: 'Context x, String version',
      javaCode: `
        try {
          var writer = getWriter();
          String entry = String.format("%s\\"version\\":\\"%s\\"%s", OPEN_VERSION, version, CLOSE);
          writer.write(entry);
          writer.newLine();
          writer.flush();
        } catch (Throwable t) {
          t.printStackTrace();
          getLogger().error("Failed to write version", version);
        }
      `
    },
    {
      name: 'put',
      type: 'FObject',
      args: [ 'Context x', 'String prefix', 'DAO dao', 'foam.lang.FObject obj' ],
      javaCode: `
        final Object               id  = obj.getProperty("id");
        final ClassInfo            of  = dao.getOf();
        final JSONFObjectFormatter fmt = getFormatter(x);

        getLine().enqueue(new foam.util.concurrent.AbstractAssembly() {
          FObject old;

          public Object[] requestLocks() {
            return new Object[] { id };
          }

          public void executeUnderLock() {
            old = dao.find_(x, id);
            dao.put_(x, obj);
          }

          public void executeJob() {
            try {
              if ( old != null && old != obj ) {
                fmt.maybeOutputDelta(old, obj, null, of);
              } else {
                fmt.output(obj, of);
              }
            } catch (Throwable t) {
              getLogger().error("Failed to format put", of.getId(), "id", id, t);
              fmt.reset();
            }
          }

          public void endJob(boolean isLast) {
            if ( fmt.builder().length() == 0 ) return;

            try {
              writeComment_(x, obj);
              writePut_(
                x,
                old == null,
                fmt.builder(),
                getMultiLineOutput() ? "\\n" : "",
                SafetyUtil.isEmpty(prefix) ? "" : prefix + ".");
              if ( isLast ) getWriter().flush();
            } catch (Throwable t) {
              getLogger().error("Failed to write put", of.getId(), "id", id, t);
            } finally {
              fmt.reset();
            }
          }
        });

        return obj;
      `
    },
    {
      name: 'writePut_',
      javaThrows: [ 'java.io.IOException' ],
      args: 'Context x, Boolean create, CharSequence record, String c, String prefix',
      javaCode: `
      PM pm = PM.create(x, "FileJournal:write");
      BufferedWriter writer = getWriter();
      writer.write(prefix);
      if ( create )
        writer.write(OP_CREATE);
      else
        writer.write(OP_PUT);
      writer.write(OP_OPEN);
      writer.append(record);
      writer.write(OP_CLOSE);
      writer.write(c);
      writer.newLine();
      pm.log(x);
      `
    },
    {
      name: 'remove',
      type: 'FObject',
      args: [ 'Context x', 'String prefix', 'DAO dao', 'foam.lang.FObject obj' ],
      javaCode: `
      final Object id = obj.getProperty("id");
      JSONFObjectFormatter fmt = getFormatter(x);
      getLine().enqueue(new foam.util.concurrent.AbstractAssembly() {

        public Object[] requestLocks() {
          return new Object[] { id };
        }

        public void executeUnderLock() {
          dao.remove_(x, obj);
        }

        public void executeJob() {
          try {
            // TODO: Would be more efficient to output the ID portion of the object.  But
            // if ID is an alias or multi part id we should only output the
            // true properties that ID/MultiPartID maps too.
            FObject toWrite = (FObject) obj.getClassInfo().newInstance();
            toWrite.setProperty("id", obj.getProperty("id"));
            fmt.output(toWrite, dao.getOf());
          } catch (Throwable t) {
            getLogger().error("Failed to write remove", dao.getOf().getId(), "id", id, t);
          }
        }

        public void endJob(boolean isLast) {
          if ( fmt.builder().length() == 0 ) return;

          try {
            writeComment_(x, obj);
            writeRemove_(x, fmt.builder(), SafetyUtil.isEmpty(prefix) ? "" : prefix + ".");

            if ( isLast ) getWriter().flush();
          } catch (Throwable t) {
            getLogger().error("Failed to write remove", dao.getOf().getId(), "id", id, t);
          }
        }
      });

      return obj;
      `
    },
    {
      name: 'writeRemove_',
      javaThrows: [
        'java.io.IOException'
      ],
      args: ['Context x', 'CharSequence record', 'String prefix' ],
      javaCode: `
      write_(sb.get()
        .append(prefix)
        .append(OP_REMOVE)
        .append(OP_OPEN)
        .append(record)
        .append(OP_CLOSE));
      getWriter().newLine();
      `
    },
    {
      name: 'write_',
      javaThrows: [
        'java.io.IOException'
      ],
      args: ['CharSequence data'],
      javaCode: `
        BufferedWriter writer = getWriter();
        writer.append(data);
      `
    },
    {
      name: 'writeComment_',
     // synchronized: true,
      javaThrows: [
        'java.io.IOException'
      ],
      args: [ 'Context x', 'foam.lang.FObject obj' ],
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();
        if ( user == null || user.getId() <= 1 ) return;
        if ( obj instanceof LastModifiedByAware && ((LastModifiedByAware) obj).getLastModifiedBy() != 0L ) return;

        long userId = user.getId();
        if ( ! shouldComment_(userId) ) return;

        write_(sb.get()
          .append("// Modified by ")
          .append(user.toSummary())
          .append(" (")
          .append(userId)
          .append(") at ")
          .append(getTimeStamper().createTimestamp()));
        getWriter().newLine();
      `
    },
    {
      name: 'shouldComment_',
      args: 'long userId',
      type: 'Boolean',
      documentation: `Whether this write needs an attribution comment of its own,
        recording it as the last one when it does.

        Kept apart from writeComment_ so that changing what a comment says does
        not mean restating when one gets written.`,
      javaCode: `
        long window = getCommentWindowMs();
        long now    = System.currentTimeMillis();
        long at     = window > 1 ? ( now / window ) * window : now;

        if ( at == getLastTimestamp() && userId == getLastUser() ) return false;

        setLastTimestamp(at);
        setLastUser(userId);
        return true;
      `
    },
    {
      name: 'getEntry',
      documentation: 'retrieves a meaningful unit of text from the journal',
      type: 'CharSequence',
      args: [ 'BufferedReader reader' ],
      javaCode: `
        try {
          String line = reader.readLine();
          if ( line == null ) return null;
          if ( ! line.equals(OPEN_PUT) && ! line.equals(OPEN_CREATE) && ! line.equals(OPEN_REMOVE) ) return line;
          stringBuilder.setLength(0);
          stringBuilder.append(line);
          while( ! line.equals(CLOSE) ) {
            if ( (line = reader.readLine()) == null ) break;
            if ( line.equals(OPEN_PUT) || line.equals(OPEN_CREATE) || line.equals(OPEN_REMOVE) ) {
              getLogger().error("Entry is not properly closed", stringBuilder.toString());
            }
            stringBuilder.append('\\n');
            stringBuilder.append(line);
          }
          return stringBuilder;
        } catch (Throwable t) {
          getLogger().error("Failed to read", t);
          return null;
        }
      `
    },
    {
      name: 'getParsingErrorMessage',
      documentation: 'Gets the result of a failed parsing of a journal line',
      type: 'CharSequence',
      args: [ 'String line' ],
      javaCode: `
        Parser        parser = ExprParser.instance();
        PStream       ps     = new StringPStream();
        ParserContext x      = new ParserContextImpl();

        ((StringPStream) ps).setString(line);
        x.set("X", ( getX() == null ) ? new ProxyX() : getX());

        ErrorReportingPStream erpst = new ErrorReportingPStream(ps);
        ErrorReportingPStreamFactory factory = new ErrorReportingPStreamFactory(erpst, getFilename());
        factory.create(getX());

        ps = factory.apply(parser, x);
        return factory.getMessage();
      `
    },
    {
      name: 'mergeFObject',
      type: 'foam.lang.FObject',
      documentation: `Merge the diff's set properties into the old object and
        return the merged row.

        When the classes match the merged old object is the row: a second pass
        copying every set property back into the diff would only fire each
        setter again, and on an update-heavy journal that pass was half the
        serial apply cost. When the entry changed the row's class the diff, of
        the new class, carries the old values instead.`,
      args: ['FObject oldFObject', 'FObject diffFObject' ],
      javaCode: `
        //get PropertyInfos
        List list = oldFObject.getClassInfo().getAxiomsByClass(PropertyInfo.class);
        Iterator e = list.iterator();

        while( e.hasNext() ) {
          PropertyInfo prop = (PropertyInfo) e.next();
          mergeProperty(oldFObject, diffFObject, prop);
        }
        if ( oldFObject.getClass() == diffFObject.getClass() ) return oldFObject;
        // it's backwards in case when we override the "class" was changed
        return diffFObject.copyFrom(oldFObject);
      `
    },
    {
      name: 'mergeProperty',
      args: [ 'FObject oldFObject', 'FObject diffFObject', 'foam.lang.PropertyInfo prop' ],
      javaCode: `
      try {
        if ( prop.isSet(diffFObject) ) {
          Object diffObj = prop.get(diffFObject);
          if ( prop instanceof AbstractFObjectPropertyInfo &&
               prop.get(oldFObject) != null &&
               diffObj != null &&
               diffObj instanceof FObject ) {
            FObject oldNestedFObj  = (FObject) prop.get(oldFObject);
            FObject nestedDiffFObj = (FObject) diffObj;
            if ( oldNestedFObj.getClassInfo() != nestedDiffFObj.getClassInfo() ) {
              FObject nestedOldDiff = nestedDiffFObj.fclone();
              nestedOldDiff.copyFrom(oldNestedFObj);
              // have to explicitly set the value because nestedOldDiff is a clone
              prop.set(oldFObject, mergeFObject(nestedOldDiff, nestedDiffFObj));
            } else {
              mergeFObject(oldNestedFObj, nestedDiffFObj);
            }
          } else {
            prop.set(oldFObject, diffObj);
          }
        }
      } catch(ClassCastException e) {
        String msg = "******************* UNEXPECTED CCE " + oldFObject + " " + diffFObject + " " + prop.getName();
        getLogger().error(msg);
        System.err.println(msg);
        throw e;
      }
      `
    },
    {
      documentation: `Freeze the live journal as the next generation and start a
        fresh one. Returns the frozen filename.

        Ordered against writes by running on the journal's own assembly line,
        so it needs no cooperation from the caller -- no blocking DAO, no paused
        traffic. See doc/guides/JournalFiles.md.`,
      name: 'roll',
      args: 'X x',
      type: 'String',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      final String filename = getFilename();
      logger.info("roll", filename);
      PM pm = PM.create(x, this.getClass().getSimpleName(), "roll");

      final AbstractF3FileJournal self   = this;
      final String                frozen = filename + "." + new JournalGenerations(x, filename).nextGeneration();
      final Throwable[]           failed = new Throwable[1];

      // Every put and remove already passes through getLine(), so running the
      // cutover there orders it against them by construction: writes enqueued
      // before this one have written their bytes, writes after it open the
      // fresh file. Nothing blocks, and no caller has to pause traffic first.
      //
      // That ordering is also what makes a rename safe. The usual objection --
      // that a rename moves only the inode, leaving the VM writing into the
      // renamed file -- applies to a writer left open across it. Here the
      // writer is closed first and the cached one cleared after, so the next
      // write opens the new file. A rename moves no data, so the cutover costs
      // the same whether the journal is a megabyte or a hundred gigabytes.
      getLine().enqueue(new foam.util.concurrent.AbstractAssembly() {
        public void endJob(boolean isLast) {
          try {
            self.getWriter().flush();
            self.getWriter().close();

            Files.move(x.get(FileSystemStorage.class).get(filename).toPath(),
              x.get(FileSystemStorage.class).get(frozen).toPath(),
              StandardCopyOption.ATOMIC_MOVE);
          } catch (Throwable t) {
            failed[0] = t;
          } finally {
            // Whether or not the move landed, the closed writer must not be
            // reused -- the next write has to open a file.
            AbstractF3FileJournal.WRITER.clear(self);
          }
        }
      });

      if ( failed[0] != null ) {
        logger.error("roll", filename, failed[0]);
        pm.error(x, failed[0]);
        throw new RuntimeException(failed[0].getMessage());
      }

      pm.log(x);
      logger.info("roll", "complete", frozen);
      return frozen;
      `
    },
    {
      name: 'cmd',
      args: 'X x, Object obj',
      type: 'Object',
      javaCode: `
      if ( obj != null &&
           obj instanceof FileRollCmd ) {
        FileRollCmd cmd = (FileRollCmd) obj;
        // DAOs have to explicitly pass cmd to Journals, so common
        // for loops. Test if already handled.
        if ( SafetyUtil.isEmpty(cmd.getRolledFilename()) &&
             SafetyUtil.isEmpty(cmd.getError()) ) {
          try {
            cmd.setRolledFilename(roll(x));
            ((foam.core.logger.Logger) x.get("logger")).info(this.getClass().getSimpleName(), "cmd", "FileRollCmd", cmd.getRolledFilename());
          } catch (Throwable t) {
            cmd.setError(t.getMessage());
          }
        }
        return cmd;
      }
      // retain behaviour of AbstractDAO returning null to indicate not handled.
      return null;
      `
    }
  ]
});
