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
      name: 'of',
      class: 'Class'
    },
    {
      name: 'filename',
      class: 'String'
    },
    {
      documentation: `Size of ByteBuffers used during findRoot and load
for reading chunks of the file rather than 1 byte at a time.
NOTE: minimum size must be no smaller than half the size of the Root marker.
To ensure that the Root marker is identified even when split between two
buffers.`,
      name: 'chunkBufferSize',
      class: 'Int',
      value: 1048576 // 1Mb
    }
  ],

  javaCode: `
    protected FileChannel            channel_;
    protected long                   size_;
    protected ByteBuffer             buffer_;
    protected JSONFObjectFormatter   formatter_;
    protected JSONParser             parser_;
    final protected CharsetDecoder   decoder_ = StandardCharsets.UTF_8.newDecoder();
    static final protected byte[]    PREFIX = "p(".getBytes(StandardCharsets.UTF_8);
    static final protected byte[]    POSTFIX = ")\\n".getBytes(StandardCharsets.UTF_8);

    public FileStore(X x, ClassInfo of, String filename)
      throws IOException {
      setX(x);
      setOf(of);
      setFilename(filename);

      initialize();
    }

    protected void initialize()
      throws IOException {
      X x = getX();
      File file = x.get(FileSystemStorage.class).get(getFilename());
      try {
        Files.createFile(file.toPath());
      } catch ( java.nio.file.FileAlreadyExistsException e ) {
        // nop;
      }
      channel_   = new RandomAccessFile(file.getPath(), "rw").getChannel();
      channel_.force(true); // config?
      size_      = channel_.size();
      formatter_ = new JSONFObjectFormatter(x);
      formatter_.setPropertyPredicate(new StoragePropertyPredicate());
      formatter_.setOutputShortNames(true);
      formatter_.setOutputClassNames(false);
//      formatter_.setOutputDefaultClassNames(false);
//      formatter_.setOutputReadableDates(true); // not working
      parser_    = new JSONParser(x);
      buffer_    = ByteBuffer.allocate(getChunkBufferSize());

      if ( channel_.size() > 0 ) {
        findRoot();
      }
    }
  `,

  methods: [
    {
      documenation: 'Build support - useful for test cases',
      name: 'init_',
      javaCode: `
      try {
        initialize();
      } catch (java.io.IOException e) {
        throw new RuntimeException(e);
      }
      `
    },
    {
      documentation: `Calculate the length of the index object and store this
in the Root marker object, then when later we find the root on a restart,
we have both the start offset and length to load it.`,
      name: 'storeRoot',
      javaCode: `
        X x = getX();
        formatter_.reset();
        formatter_.setX(x);
        formatter_.output(obj, getOf());
        int len = formatter_.builder().length() + PREFIX.length + POSTFIX.length; // p(...)
        store(new Root(size_, len));
        setRoot(store(obj));
        return getRoot();
      `
    },
    {
      name: 'store',
      javaCode: `
      X x = getX();
      PM pm = new PM("FileStore:store");
      try {
        formatter_.reset();
        formatter_.setX(x);
        formatter_.output(obj, getOf());
        channel_.position(size_);
        long pos = channel_.position();
        channel_.write(ByteBuffer.wrap(PREFIX));
        channel_.write(ByteBuffer.wrap(formatter_.builder().toString().getBytes(StandardCharsets.UTF_8)));
        channel_.write(ByteBuffer.wrap(POSTFIX));
        size_ = channel_.position();
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
      documentation: `Retrieve object at stored location. The passed
stored updated with the retrieved object and returned.`,
      name: 'load',
      args: 'foam.dao.store.Stored stored',
      type: 'foam.dao.store.Stored',
      javaCode: `
      if ( stored == null ) return null;

      X x = getX();
      PM pm = new PM("FileStore:load");
      FileStored fs = (FileStored) stored;
      try {
        // NOTE: extra PMs added for intial performance testing
        PM pmBuffer = new PM("FileStore:load:buffer");
        ByteBuffer buffer = buffer_;
        if ( fs.getLen() > getChunkBufferSize() ) {
          Loggers.logger(x, this).warning("load", "Allocating buffer of size", fs.getLen(), "Configured with",getChunkBufferSize());
          buffer = ByteBuffer.allocate(fs.getLen());
        }
        buffer.clear();
        pmBuffer.log(x);
        PM pmRead = new PM("FileStore:load:read");
        channel_.read(buffer, fs.getPos());
        pmRead.log(x);
        PM pmDecode = new PM("FileStore:load:decode");
        buffer.flip();
        String decoded = decoder_.decode(buffer).toString();
        decoded = decoded.substring(PREFIX.length, fs.getLen() - POSTFIX.length); // strip p(...)\n
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
      javaCode: `
      X x = getX();
      PM pm = new PM("FileStore:findRoot");

      // Read two 'chunks' to handle the Root stradling a read block
      // Write the first chunk to the second half of buffer
      // and the second chunk position alligned with the end of
      // of the first half of the buffer.
      // Then find Root and calculate the position in the buffer and
      // translate to a real file offset so the real Root object can
      // be read.

      int chunkBufferSize = getChunkBufferSize();
      int offset = chunkBufferSize;
      ByteBuffer chunkBuffer = ByteBuffer.allocate(chunkBufferSize);
      ByteBuffer buffer = ByteBuffer.allocate(2 * chunkBufferSize);
      try {
        if ( channel_.size() == 0 ) return;
        long chunkStart = Math.max(0, channel_.size() - chunkBufferSize);
        int bytesRead = channel_.read(chunkBuffer, chunkStart);
        chunkBuffer.flip(); // reading

        while ( true ) {
          if ( bytesRead == 0 )
            break;

          buffer.position(chunkBufferSize); // write to second half of buffer
          buffer.put(chunkBuffer.array(), 0, bytesRead);
          buffer.position(0);

          if ( bytesRead == chunkBufferSize ) {
            int desiredBytes = chunkBufferSize;
            if ( chunkStart < chunkBufferSize ) {
              desiredBytes = (int) chunkStart;
            }
            chunkStart = Math.max(0, chunkStart - chunkBufferSize);
            chunkBuffer.clear();
            bytesRead = channel_.read(chunkBuffer, chunkStart);
            chunkBuffer.position(0);

            // when less than a full buffer, align with start of second half
            int pos = chunkBufferSize - desiredBytes;
            offset = pos;
            buffer.position(pos);
            buffer.put(chunkBuffer.array(), 0, desiredBytes); // write to first half
            buffer.position(pos);
          }

          buffer.limit(buffer.capacity()); // make entire buffer available for reading
          String s = decoder_.decode(buffer).toString();

          int index = s.lastIndexOf(Root.ROOT_MARKER_START);

          if ( index >= 0 ) {
            String marker = s.substring(index, Math.min(index + 100, s.length()));
            int end = marker.indexOf(Root.ROOT_MARKER_END);
            if ( end > 0 ) {
              int len = end + Root.ROOT_MARKER_END.length() + 1;

              long pos = chunkStart + (index - offset);
              FileStored stored = (FileStored) load(new FileStored(this, pos, len, null));
              Root root = (Root) stored.get();
              // load real root index
              stored = new FileStored(this, pos + len, root.getLen(), null);
              setRoot(load(stored));
              return;
            }
          }
          if ( bytesRead < chunkBufferSize )
            break;

          buffer.clear();
          chunkBuffer.rewind(); // prepare for re-read into buffer
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
          // REVIEW: this property may not be necessary
          name: 'store',
          class: 'FObjectProperty',
          of: 'foam.dao.store.FileStore',
          visibility: 'HIDDEN',
          transient: true
        },
        {
          name: 'pos',
          class: 'Long',
          shortName: 'p'
        },
        {
          name: 'len',
          class: 'Int',
          shortName: 'l'
        }
      ]
    },
    {
      name: 'Root',

      documentation: `There is nothing to distinguish a \'Root\' Index from any other,
so this model acts as a marker to denote where a \'Root\' Index is located.`,

      constants: [
        {
          name: 'ROOT_MARKER_START',
          type: 'String',
          value: "p({class:\"foam.dao.store.FileStore.Root\""
        },
        {
          name: 'ROOT_MARKER_END',
          type: 'String',
          value: "})"
        }
      ],

      properties: [
        {
          name: 'pos',
          class: 'Long',
          shortName: 'p'
        },
        {
          name: 'len',
          class: 'Int',
          shortName: 'l'
        },
        {
          name: 'created',
          class: 'DateTime',
          shortName: 'c'
        }
      ],

      javaCode: `
  public Root(long pos, int len) {
    setPos(pos);
    setLen(len);
    setCreated(new java.util.Date());
  }
  `
    }
  ]
});
