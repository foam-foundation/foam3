/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.dao.store',
  name: 'FileStore',
  implements: [ 'foam.dao.store.Store' ],

  documentation: ``,

  javaImports: [
    'foam.core.fs.FileSystemStorage',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.lib.StoragePropertyPredicate',
    'foam.lib.formatter.JSONFObjectFormatter',
    'foam.lib.json.JSONParser',
    'foam.util.SafetyUtil',
    'java.io.File',
    'java.io.IOException',
    'java.io.RandomAccessFile',
    'java.nio.ByteBuffer',
    'java.nio.channels.FileChannel',
    'java.nio.charset.CharsetDecoder',
    'java.nio.charset.StandardCharsets',
    'java.nio.file.Files'
  ],

  properties: [
    {
      name: 'filename',
      class: 'String'
    },
    {
      name: 'of',
      class: 'Class'
    }
  ],

  javaCode: `
    protected FileChannel              channel_;
    protected long                     size_;
    protected ByteBuffer               buffer_;
    protected JSONFObjectFormatter     formatter_;
    protected JSONParser               parser_;
    final protected int                BUFFER_SIZE  = 1023;

    public FileStore(X x, String filename, ClassInfo of)
      throws IOException {
      setX(x);
      setFilename(filename);
      setOf(of);
      File file = x.get(FileSystemStorage.class).get(filename);
      try {
        Files.createFile(file.toPath());
      } catch ( java.nio.file.FileAlreadyExistsException e ) {
        // nop;
      }
      Loggers.logger(x, this).info("created", file.toPath());
      channel_   = new RandomAccessFile(file.getPath(), "rw").getChannel();
      size_      = channel_.size();
      buffer_    = ByteBuffer.allocate(BUFFER_SIZE);
      formatter_ = new JSONFObjectFormatter(x);
      formatter_.setPropertyPredicate(new StoragePropertyPredicate());
      formatter_.setOutputShortNames(true);
      parser_    = new JSONParser(x);

      findRoot(x);
    }
  `,

  methods: [
    {
      name: 'storeRoot',
      javaCode: `
        formatter_.reset();
        formatter_.setX(x);
        formatter_.output(obj, getOf());
        int len = formatter_.builder().length() + 4; // p(...)\n
        store(x, new Root(size_, len));
        setRoot(store(x, obj));
        return getRoot();
      `
    },
    {
      name: 'store',
      javaCode: `
      PM pm = new PM("FileStore:store");
      try {
        formatter_.reset();
        formatter_.setX(x);
        formatter_.output(obj, getOf());
        channel_.position(size_);
        long pos = channel_.position();
        channel_.write(ByteBuffer.wrap("p(".getBytes(StandardCharsets.UTF_8)));
        channel_.write(ByteBuffer.wrap(formatter_.builder().toString().getBytes(StandardCharsets.UTF_8)));
        channel_.write(ByteBuffer.wrap(")\\n".getBytes(StandardCharsets.UTF_8)));
        size_ = channel_.position();
        channel_.force(true);
        pm.log(x);
        return new FileStored(this, pos, (int) (size_ - pos), obj);
      } catch ( Throwable t ) {
        pm.error(x, t);
        Loggers.logger(x, this).error(getFilename(), "store", t);
        throw new RuntimeException(t);
      }
      `
    },
    {
      documentation: 'Retrieve object at stored location. The passed stored updated with the retrieved object and returned.',
      name: 'load',
      args: 'Context x, foam.dao.store.Stored stored',
      type: 'foam.dao.store.Stored',
      javaCode: `
      PM pm = new PM("FileStore:load");
      FileStored fs = (FileStored) stored;
      try {
        PM pmBuffer = new PM("FileStore:load:buffer");
        // REVIEW: FileChannel does not support read(buffer, offset, len)
        // so directly allocating buffer on each call for now
        // ByteBuffer buffer = buffer_;
        // if ( fs.getLen() > BUFFER_SIZE ) {
        //   buffer = ByteBuffer.allocate(fs.getLen());
        // }
        // buffer.clear();
        ByteBuffer buffer = ByteBuffer.allocate(fs.getLen());
        pmBuffer.log(x);
        PM pmRead = new PM("FileStore:load:read");
        channel_.read(buffer, fs.getPos());
        pmRead.log(x);
        PM pmDecode = new PM("FileStore:load:decode");
        buffer.flip();
        String decoded = StandardCharsets.UTF_8.newDecoder().decode(buffer).toString();
        decoded = decoded.substring(2, decoded.length() - 2); // strip p(...)\n
        pmDecode.log(x);
        PM pmParse = new PM("FileStore:load:parse");
        parser_.setX(x);
        FObject obj = parser_.parseString(decoded, getOf().getObjClass());
        pmParse.log(x);
        pm.log(x);
        stored.setObject(obj);
        return stored;
      } catch ( Throwable t ) {
        pm.error(x, t);
        Loggers.logger(x, this).error(getFilename(), "load", fs.getPos(), fs.getLen(), t);
        throw new RuntimeException(t);
      }
      `
    },
    {
      documentation: 'Find last root. Start at end of file and work backwards.',
      name: 'findRoot',
      args: 'Context x',
      javaCode: `

      char p = 'p';
      String classMarker = ":ssalc{(p";
      StringBuffer sb = new StringBuffer();
      ByteBuffer buffer = ByteBuffer.allocate(1);
      CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder();
      PM pm = new PM("FileStore:findRoot");
      try {
        if ( channel_.size() == 0 ) return;

        for ( long pos = size_ - 1; pos >= 0; pos -= 1 ) {
          channel_.position(pos);
          buffer.clear();
          channel_.read(buffer);
          buffer.flip();
          String c = decoder.decode(buffer).toString();
          sb.append(c);
          if ( "p".equals(c) ) {
            if ( sb.toString().endsWith(Root.ROOT_MARKER) ) {
              int len = sb.length();
              FileStored stored = (FileStored) load(x, new FileStored(this, pos, len, null));
              Root root = (Root) stored.get();
              // load real root index
              stored = new FileStored(this, pos + len, root.getLen(), null);
              setRoot(load(x, stored));
              return;
            }
            if ( sb.toString().endsWith(classMarker) ) {
              sb.delete(0, sb.length()); // reset
            }
          }
        }
        Loggers.logger(x, this).warning(getFilename(), "Root not found");
      } catch (Throwable t) {
        pm.error(x, t);
        Loggers.logger(x, this).error(getFilename(), "findRoot", t);
        throw new RuntimeException(t);
      } finally {
        pm.log(x);
      }
      `
    }
  ],

  classes: [
    {
      name: 'FileStored',
      implements: [ 'foam.dao.store.Stored' ],

      properties: [
        {
          name: 'store',
          class: 'FObjectProperty',
          of: 'foam.dao.store.FileStore'
        },
        {
          name: 'pos',
          class: 'Long'
        },
        {
          name: 'len',
          class: 'Int'
        }
      ]
    },
    {
      name: 'Root',

      documentation: `There is nothing to distinguish a \'Root\' Index from any other,
so this model acts as a marker to denote where a \'Root\' Index is located.`,

      constants: [
        {
          documentation: `Character seqeuence indicating the start of the
special object which precedes a Root Index.  The characters are reversed
as the finding logic reads the file into a buffer in inverse order.`,
          name: 'ROOT_MARKER',
          type: 'String',
          value: "\"tooR.erots.oad.maof\":ssalc{(p"
        }
      ],

      properties: [
        {
          name: 'pos',
          class: 'Long'
        },
        {
          name: 'len',
          class: 'Int'
        },
        {
          name: 'created',
          class: 'DateTime',
          javaFactory: `
        return new java.util.Date();
      `
        }
      ],

      javaCode: `
  public Root(long pos, int len) {
    setPos(pos);
    setLen(len);
  }
  `
    }
  ]
});
