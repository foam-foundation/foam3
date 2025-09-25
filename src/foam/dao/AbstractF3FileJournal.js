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
    'java.io.BufferedReader',
    'java.io.BufferedWriter',
    'java.io.File',
    'java.io.IOException',
    'java.io.InputStream',
    'java.io.InputStreamReader',
    'java.io.FileInputStream',
    'java.io.FileOutputStream',
    'java.io.OutputStream',
    'java.io.OutputStreamWriter',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.StandardCopyOption',
    'java.nio.file.StandardOpenOption',
    'java.time.format.DateTimeFormatter',
    'java.time.LocalDateTime',
    'java.util.Calendar',
    'java.util.Iterator',
    'java.util.List',
    'java.util.Set',
    'java.util.regex.Pattern',
    'java.util.TimeZone',
    'java.util.stream.Collectors',
    'java.util.stream.Stream'
  ],

  javaCode: `
    protected static Pattern COMMENT = Pattern.compile("(/\\\\*([^*]|[\\\\r\\\\n]|(\\\\*+([^*/]|[\\\\r\\\\n])))*\\\\*+/)|(//.*)");

    protected static ThreadLocal<JSONFObjectFormatter> formatter = new ThreadLocal<JSONFObjectFormatter>() {
      @Override
      protected JSONFObjectFormatter initialValue() {
        JSONFObjectFormatter b = new JSONFObjectFormatter();
        b.setPropertyPredicate(new StoragePropertyPredicate());
        b.setOutputShortNames(true);
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
  `,

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
        return new PrefixLogger(new Object[] { "[JDAO]" }, logger);
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
    // reader uses a getter because we want a new reader on file replay
    {
      class: 'Object',
      name: 'reader',
      javaType: 'java.io.BufferedReader',
      javaGetter: `
try {
  InputStream is = getX().get(Storage.class).getInputStream(getFilename());
  if ( is == null ) {
    getLogger().warning("File not found", "for reading", getFilename());
    return null;
  }
  // Setting a larger buffer size increases performance by 10-15%
  return new BufferedReader(new InputStreamReader(is), 1024 * 1024 * 2);
} catch ( Throwable t ) {
  getLogger().error("Failed to initialize reader", getFilename(), t);
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
    getLogger().warning("File not found", "for writing", getFilename());
    return null;
  }
  return new BufferedWriter(new OutputStreamWriter(os));
} catch ( Throwable t ) {
  getLogger().error("Failed to initialize writer", getFilename(), t);
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
    }
  ],

  methods: [
    {
      name: 'writeVersion',
      type: 'Void',
      args: 'Context x, String version',
      javaCode: `
        try {
          var writer = getWriter();
          String entry = String.format("v({\\"version\\":\\"%s\\"})", version);
          writer.write(entry);
          writer.newLine();
          writer.flush();
        } catch (java.io.IOException e) {
          Loggers.logger(x, this).error("Failed to write to journal file: ", getFilename(), " for version ", version );
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
              getLogger().error("Failed to format put", getFilename(), of.getId(), "id", id, t);
              fmt.reset();
            }
          }

          public void endJob(boolean isLast) {
            if ( fmt.builder().length() == 0 ) return;

            try {
              writeComment_(x, obj);
              writePut_(
                x,
                fmt.builder(),
                getMultiLineOutput() ? "\\n" : "",
                SafetyUtil.isEmpty(prefix) ? "" : prefix + ".");
              if ( isLast ) getWriter().flush();
            } catch (Throwable t) {
              getLogger().error("Failed to write put", getFilename(), of.getId(), "id", id, t);
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
      javaThrows: [
        'java.io.IOException'
      ],
      args: [ 'Context x', 'CharSequence record', 'String c', 'String prefix' ],
      javaCode: `
      PM pm = PM.create(x, "FileJournal", "write");
      BufferedWriter writer = getWriter();
      writer.write(prefix);
      writer.write("p(");
      writer.append(record);
      writer.write(')');
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
            getLogger().error("Failed to write remove", getFilename(), dao.getOf().getId(), "id", id, t);
          }
        }

        public void endJob(boolean isLast) {
          if ( fmt.builder().length() == 0 ) return;

          try {
            writeComment_(x, obj);
            writeRemove_(x, fmt.builder(), SafetyUtil.isEmpty(prefix) ? "" : prefix + ".");

            if ( isLast ) getWriter().flush();
          } catch (Throwable t) {
            getLogger().error("Failed to write remove", getFilename(), dao.getOf().getId(), "id", id, t);
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
        .append("r(")
        .append(record)
        .append(")"));
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
        long now    = System.currentTimeMillis();
        long userId = user.getId();
        if ( now == getLastTimestamp() && userId == getLastUser() ) return;
        setLastTimestamp(now);
        setLastUser(userId);

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
      name: 'getEntry',
      documentation: 'retrieves a meaningful unit of text from the journal',
      type: 'CharSequence',
      args: [ 'BufferedReader reader' ],
      javaCode: `
        try {
          String line = reader.readLine();
          if ( line == null ) return null;
          if ( ! line.equals("p({") && ! line.equals("r({") ) return line;
          stringBuilder.setLength(0);
          stringBuilder.append(line);
          while( ! line.equals("})") ) {
            if ( (line = reader.readLine()) == null ) break;
            if ( line.equals("p({") ) {
              getLogger().error("Entry is not properly closed: " + stringBuilder.toString());
            }
            stringBuilder.append("\\n");
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
      documentation: 'Add diff property to old property',
      args: ['FObject oldFObject', 'FObject diffFObject' ],
      javaCode: `
        //get PropertyInfos
        List list = oldFObject.getClassInfo().getAxiomsByClass(PropertyInfo.class);
        Iterator e = list.iterator();

        while( e.hasNext() ) {
          PropertyInfo prop = (PropertyInfo) e.next();
          mergeProperty(oldFObject, diffFObject, prop);
        }
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
        String msg = "******************* UNEXPECTED CCE " + oldFObject + " " + diffFObject + " " + prop.getName()+ " "+ getFilename();
        getLogger().error(msg);
        System.err.println(msg);
        throw e;
      }
      `
    },
    {
      documentation: 'Backup/rename existing file with the next sequence number. New writes to new empty file.  NOTE: relies on upstream logic to block/pause io to journal',
      name: 'roll',
      args: 'X x',
      type: 'String',
      javaCode: `
      Logger logger = Loggers.logger(x, this);
      String filename = getFilename();
      logger.info("roll", filename);
      PM pm = PM.create(x, this.getClass().getSimpleName(), "roll");
      try {
        getWriter().flush();
        getWriter().close();
        AbstractF3FileJournal.WRITER.clear(this);

        // set filename to something that will fail file reading/writing.
        setFilename(null);

        // NOTE: java File rename or move under Linux does not
        // allow for swapping files.  When file A is renamed to B,
        // just the inode is updated, the file is unchanged,
        // and the VM file operations continue to act against
        // the original inode.
        // Employing copy and truncate as an alternative.

        File existing = x.get(FileSystemStorage.class).get(filename);
        String backup = filename + "." + nextSuffix(x, filename);
        File copy = x.get(FileSystemStorage.class).get(backup);

        // Copy - faster than Files.copy (apparently)
        try (
          InputStream is = new FileInputStream(existing);
          OutputStream os = new FileOutputStream(copy);
        ) {
          byte[] buffer = new byte[4096];
          int length =0;
          while ( (length = is.read(buffer)) > 0 ) {
            os.write(buffer, 0, length);
          }
        }
        // truncate original
        Files.write(existing.toPath(), new byte[0], StandardOpenOption.TRUNCATE_EXISTING);

        setFilename(filename);
        AbstractF3FileJournal.WRITER.clear(this);

        pm.log(x);
        return backup;
      } catch (IOException e) {
        logger.error("roll", filename, e);
        pm.error(x, e);
        throw new RuntimeException(e.getMessage());
      }
      `
    },
    {
      name: 'nextSuffix',
      args: 'X x, String filename',
      type: 'Long',
      javaThrows: ['java.io.IOException'],
      javaCode: `
        long suffix = 0;
        Set<String> names = Stream.of(x.get(FileSystemStorage.class).get(filename).getParentFile().listFiles())
          .filter(file -> !file.isDirectory())
          .filter(file -> file.getName().startsWith(filename))
          .map(File::getName)
          .sorted()
          .collect(Collectors.toSet());
        for ( String name : names ) {
          int p = name.lastIndexOf(".");
          if ( p == filename.length() ) {
            try {
              long s = Long.parseLong(name.substring(p+1));
              if ( s > suffix ) {
                suffix = s;
              }
            } catch (NumberFormatException e) {
              Loggers.logger(x, this).debug("nextSuffix", name, e.getMessage());
            }
          }
        }
        suffix += 1;
        return suffix;
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
