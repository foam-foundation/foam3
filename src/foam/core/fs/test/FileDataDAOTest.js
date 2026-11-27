/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.test',
  name: 'FileDataDAOTest',
  extends: 'foam.core.test.Test',
  flags: ['java'],

  documentation: `FileDataDAO stores the size of the bytes it received, not the size the sender
    claimed. A file sent as a base64 dataString is measured from the decoded string, the same
    as a file sent as a blob.`,

  javaImports: [
    'foam.blob.InputStreamBlob',
    'foam.core.fs.File',
    'foam.core.fs.FileDataDAO',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.lang.X',
    'java.io.ByteArrayInputStream'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        MDAO store = new MDAO(File.getOwnClassInfo());
        DAO  dao   = new FileDataDAO.Builder(x).setDelegate(store).build();

        // 2,800,000 base64 characters decode to 2,100,000 bytes.
        dao.put_(x, file("big", 10, "data:application/pdf;base64," + "A".repeat(2800000)));
        File big = (File) store.find_(x, "big");
        test(big != null && big.getFilesize() == 2100000L,
          "dataString: the decoded size is stored, not the claimed 10 (got " + ( big == null ? null : big.getFilesize() ) + ")");

        // "aGVsbG8=" is "hello", 5 bytes.
        dao.put_(x, file("small", 0, "data:text/plain;base64,aGVsbG8="));
        File small = (File) store.find_(x, "small");
        test(small != null && small.getFilesize() == 5L,
          "dataString: a small string is measured as well (got " + ( small == null ? null : small.getFilesize() ) + ")");

        // A blob was already measured; under 3 KB it is kept as a dataString.
        byte[] hello = "hello".getBytes();
        File sent = file("blob", 99, null);
        sent.setData(new InputStreamBlob(new ByteArrayInputStream(hello), hello.length));
        dao.put_(x, sent);
        File blob = (File) store.find_(x, "blob");
        test(blob != null && blob.getFilesize() == 5L,
          "blob: the blob's size is stored, not the claimed 99 (got " + ( blob == null ? null : blob.getFilesize() ) + ")");
        test(blob != null && "data:text/plain;base64,aGVsbG8=".equals(blob.getDataString()),
          "blob: a small blob is stored as a dataString (got " + ( blob == null ? null : blob.getDataString() ) + ")");
      `
    },
    {
      name: 'file',
      type: 'foam.core.fs.File',
      args: 'String id, long filesize, String dataString',
      javaCode: `
        File f = new File();
        f.setId(id);
        f.setFilename(id);
        f.setMimeType(dataString != null && dataString.startsWith("data:application/pdf") ? "application/pdf" : "text/plain");
        f.setFilesize(filesize);
        if ( dataString != null ) f.setDataString(dataString);
        return f;
      `
    }
  ]
});
