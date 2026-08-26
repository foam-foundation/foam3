/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.blob',
  name: 'BlobStoreTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Concurrent puts into the blob store must each land intact. allocateTmp hands
    every put its own tmp file; if two puts share one, the second FileOutputStream
    truncates the first's bytes, one rename wins with mixed content and the other
    finds its tmp gone, so the blob is either corrupt or missing.
  `,

  javaImports: [
    'java.io.ByteArrayOutputStream',
    'java.util.Arrays',
    'java.util.concurrent.CountDownLatch',
    'java.util.concurrent.TimeUnit'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        final BlobService store = (BlobService) x.get("blobStore");
        test(store != null, "blobStore is registered");
        if ( store == null ) return;

        // Distinct payloads, large enough that writers overlap in time.
        final int n = 32;
        final byte[][] payloads = new byte[n][];
        for ( int i = 0 ; i < n ; i++ ) {
          payloads[i] = new byte[64 * 1024 + i];
          Arrays.fill(payloads[i], (byte) ('A' + i % 26));
          payloads[i][payloads[i].length - 1] = (byte) i;
        }

        final String[]    ids    = new String[n];
        final Throwable[] errors = new Throwable[n];
        final CountDownLatch start = new CountDownLatch(1);
        final CountDownLatch done  = new CountDownLatch(n);
        for ( int i = 0 ; i < n ; i++ ) {
          final int k = i;
          new Thread(() -> {
            try {
              start.await();
              IdentifiedBlob b = (IdentifiedBlob) store.put(new ByteArrayBlob(payloads[k]));
              ids[k] = b == null ? null : b.getId();
            } catch ( Throwable t ) {
              errors[k] = t;
            } finally {
              done.countDown();
            }
          }).start();
        }
        start.countDown();
        boolean finished = false;
        try {
          finished = done.await(60, TimeUnit.SECONDS);
        } catch ( InterruptedException e ) {
          Thread.currentThread().interrupt();
        }
        test(finished, "all " + n + " concurrent puts finished");

        int stored = 0, intact = 0;
        for ( int i = 0 ; i < n ; i++ ) {
          if ( errors[i] != null || ids[i] == null ) continue;
          Blob found;
          try {
            found = store.find(ids[i]);
          } catch ( Throwable t ) {
            continue;
          }
          if ( found == null ) continue;
          stored++;
          ByteArrayOutputStream os = new ByteArrayOutputStream();
          found.read(os, 0, found.getSize());
          if ( Arrays.equals(os.toByteArray(), payloads[i]) ) intact++;
        }
        test(stored == n, "every concurrent put is retrievable (" + stored + " of " + n + ")");
        test(intact == n, "every retrieved blob holds its own bytes (" + intact + " of " + n + ")");

        // Identical content put concurrently must dedupe to one id and stay readable.
        final byte[] same = payloads[0];
        final String[] sameIds = new String[8];
        final CountDownLatch sameDone = new CountDownLatch(sameIds.length);
        for ( int i = 0 ; i < sameIds.length ; i++ ) {
          final int k = i;
          new Thread(() -> {
            try {
              IdentifiedBlob b = (IdentifiedBlob) store.put(new ByteArrayBlob(same));
              sameIds[k] = b == null ? null : b.getId();
            } catch ( Throwable t ) {
            } finally {
              sameDone.countDown();
            }
          }).start();
        }
        try {
          sameDone.await(60, TimeUnit.SECONDS);
        } catch ( InterruptedException e ) {
          Thread.currentThread().interrupt();
        }
        boolean oneId = true;
        for ( String id : sameIds ) oneId = oneId && ids[0].equals(id);
        test(oneId, "concurrent puts of the same bytes share one id");
        Blob deduped = null;
        try {
          deduped = store.find(ids[0]);
        } catch ( Throwable t ) {}
        test(deduped != null && deduped.getSize() == same.length, "the deduped blob is still readable");
      `
    }
  ]
});
