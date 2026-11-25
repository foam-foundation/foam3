/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'IDBDAOBlobRecord',
  documentation: 'A row holding a File directly and inside an array of plain objects, for IDBDAOBlobTest.',
  properties: [
    { class: 'String', name: 'id' },
    { class: 'Object', name: 'file' },
    { class: 'Array',  name: 'files' }
  ]
});

foam.CLASS({
  package: 'foam.dao.test',
  name: 'IDBDAOBlobTest',
  extends: 'foam.core.test.JSTest',

  documentation: `A browser keeps a user's files in IndexedDB as they are, so an
    IDBDAO row can hold a dropped file. The row is turned into plain JSON before
    it is stored, and a File has no keys of its own, so it was stored as {}.`,

  requires: [
    'foam.dao.IDBDAO',
    'foam.dao.test.IDBDAOBlobRecord'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var dao  = this.IDBDAO.create({ of: this.IDBDAOBlobRecord, name: 'IDBDAOBlobTest' + Date.now() }, x);
        var file = new File([ 'a,b\n1,2\n' ], 'report.csv', { type: 'text/csv' });
        try {
          await dao.put(this.IDBDAOBlobRecord.create({ id: 'r1', file: file, files: [ { file: file, note: 'kept' } ] }));
          var back = await dao.find('r1');
          x.test(back.file instanceof File, 'a File property comes back as a File, not {}');
          x.test(back.file.name === 'report.csv' && back.file.type === 'text/csv', 'with its name and type');
          x.test(await back.file.text() === 'a,b\n1,2\n', 'and its contents');
          var entry = back.files[0];
          x.test(entry.file instanceof File && await entry.file.text() === 'a,b\n1,2\n', 'a File inside an array of plain objects comes back too');
          x.test(entry.note === 'kept', 'beside the plain values stored with it');
        } finally {
          ( await dao.withDB ).close();
          indexedDB.deleteDatabase('FOAM:' + dao.name);
        }
      }
    }
  ]
});
