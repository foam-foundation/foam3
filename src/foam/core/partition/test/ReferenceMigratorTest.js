/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition.test',
  name: 'ReferenceMigratorTest',
  extends: 'foam.core.test.Test',

  documentation: 'Tests ReferenceMigrator: ReferencePropertyInfo exposure, "of" extraction, referencer discovery, idMap-driven ref rewrite, and the migrateFrom end-to-end path with archive gated on fixup.',

  javaImports: [
    'foam.core.boot.CSpec',
    'foam.core.fs.FileSystemStorage',
    'foam.core.fs.Storage',
    'foam.core.partition.PartitionedDAO',
    'foam.core.partition.ReferenceMigrator',
    'foam.core.partition.test.PartitionStrRecord',
    'foam.core.partition.test.RefSourceRecord',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.java.JDAO',
    'foam.lang.FObject',
    'foam.lang.ReferencePropertyInfo',
    'foam.lang.X',
    'java.io.File',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        testReferencePropertyInfoExposed(x);
        testExtractOf(x);
        testDiscoverReferencers(x);
        testFixupRewritesMappedRefs(x);
        testEndToEndArchiveGatedOnFixup(x);
      `
    },
    {
      name: 'newStorageContext',
      args: 'X x',
      type: 'X',
      documentation: 'Sub-context with a temp-dir FileSystemStorage so journals are isolated.',
      javaCode: `
        String dir = System.getProperty("java.io.tmpdir") + File.separator
          + "refmig_" + System.nanoTime();
        new File(dir).mkdirs();
        FileSystemStorage fs = new FileSystemStorage(dir);
        return x.put(Storage.class, fs).put(FileSystemStorage.class, fs);
      `
    },
    {
      name: 'testReferencePropertyInfoExposed',
      args: 'X x',
      type: 'Void',
      documentation: 'Generated Reference PropertyInfo implements ReferencePropertyInfo and exposes its targetDAOKey at runtime.',
      javaCode: `
        test( RefSourceRecord.TARGET_REF instanceof ReferencePropertyInfo,
          "RefSourceRecord.TARGET_REF is an instanceof ReferencePropertyInfo" );
        if ( RefSourceRecord.TARGET_REF instanceof ReferencePropertyInfo ) {
          ReferencePropertyInfo rp = (ReferencePropertyInfo) RefSourceRecord.TARGET_REF;
          test( "partitionRefTargetDAO".equals(rp.getTargetDAOKey()),
            "getTargetDAOKey() == 'partitionRefTargetDAO', got " + rp.getTargetDAOKey() );
        }
      `
    },
    {
      name: 'testExtractOf',
      args: 'X x',
      type: 'Void',
      documentation: 'extractOf pulls the nested "of" model id from a CSpec client spec; missing "of" and empty specs return null.',
      javaCode: `
        ReferenceMigrator m = new ReferenceMigrator("k");

        String nested = "{\\"class\\":\\"com.x.Outer\\",\\"delegate\\":{\\"class\\":\\"foam.dao.EasyDAO\\",\\"serviceName\\":\\"service/x\\",\\"daoType\\":\\"CLIENT\\",\\"of\\":\\"foam.core.partition.test.PartitionStrRecord\\"}}";
        test( "foam.core.partition.test.PartitionStrRecord".equals(m.extractOf(nested)),
          "extractOf found the nested 'of', got " + m.extractOf(nested) );

        String noOf = "{\\"class\\":\\"foam.dao.EasyDAO\\",\\"daoType\\":\\"CLIENT\\"}";
        test( m.extractOf(noOf) == null,
          "extractOf returns null when no 'of' key present, got " + m.extractOf(noOf) );

        test( m.extractOf("") == null, "extractOf returns null for an empty string" );
      `
    },
    {
      name: 'testDiscoverReferencers',
      args: 'X x',
      type: 'Void',
      documentation: 'discoverReferencers scans cSpecDAO and returns only the DAOs whose model holds a Reference targeting the migrated daoKey.',
      javaCode: `
        DAO cspecs = new MDAO(CSpec.getOwnClassInfo());

        CSpec s1 = new CSpec();
        s1.setName("refSourceDAO");
        s1.setClient("{\\"class\\":\\"foam.dao.EasyDAO\\",\\"of\\":\\"foam.core.partition.test.RefSourceRecord\\"}");
        cspecs.put(s1);

        // PartitionStrRecord has no Reference to partitionRefTargetDAO — must not match.
        CSpec s2 = new CSpec();
        s2.setName("otherDAO");
        s2.setClient("{\\"class\\":\\"foam.dao.EasyDAO\\",\\"of\\":\\"foam.core.partition.test.PartitionStrRecord\\"}");
        cspecs.put(s2);

        X tx = x.put("cSpecDAO", cspecs);

        ReferenceMigrator m = new ReferenceMigrator("partitionRefTargetDAO");
        List<Object[]> refs = m.discoverReferencers(tx);

        test( refs.size() == 1,
          "discoverReferencers found exactly 1 referencing DAO, got " + refs.size() );
        test( refs.size() == 1 && "refSourceDAO".equals(refs.get(0)[0]),
          "discovered pair names 'refSourceDAO', got "
            + ( refs.size() == 1 ? refs.get(0)[0] : "<none>" ) );
        test( refs.size() == 1 && refs.get(0)[1] == RefSourceRecord.TARGET_REF,
          "discovered pair carries the TARGET_REF PropertyInfo" );
      `
    },
    {
      name: 'testFixupRewritesMappedRefs',
      args: 'X x',
      type: 'Void',
      documentation: 'fixupDAO rewrites only refs whose value is a key in the idMap, leaves everything else untouched, and returns true; a missing DAO name returns false.',
      javaCode: `
        Map<String,String> idMap = new HashMap<>();
        String mapped   = "5" + PartitionedDAO.SEPARATOR + "a";
        String unmapped = "5" + PartitionedDAO.SEPARATOR + "b";
        idMap.put("a", mapped);

        DAO refDAO = new MDAO(RefSourceRecord.getOwnClassInfo());
        RefSourceRecord r1 = new RefSourceRecord(); r1.setId(1L); r1.setTargetRef("a");      refDAO.put(r1);
        RefSourceRecord r2 = new RefSourceRecord(); r2.setId(2L); r2.setTargetRef(unmapped); refDAO.put(r2);
        RefSourceRecord r3 = new RefSourceRecord(); r3.setId(3L); r3.setTargetRef("zzz"); refDAO.put(r3);
        X tx = x.put("refSourceDAO", refDAO);

        ReferenceMigrator m = new ReferenceMigrator("partitionRefTargetDAO");
        boolean ok = m.fixupDAO(tx, "refSourceDAO", RefSourceRecord.TARGET_REF, idMap);

        test( ok, "fixupDAO returned true on a present DAO" );

        FObject f1 = refDAO.find(1L);
        FObject f2 = refDAO.find(2L);
        FObject f3 = refDAO.find(3L);
        test( f1 != null && mapped.equals(RefSourceRecord.TARGET_REF.get(f1)),
          "mapped ref 'a' rewritten to '" + mapped + "', got "
            + ( f1 == null ? "<null>" : RefSourceRecord.TARGET_REF.get(f1) ) );
        test( f2 != null && unmapped.equals(RefSourceRecord.TARGET_REF.get(f2)),
          "unmapped ref '" + unmapped + "' left alone, got "
            + ( f2 == null ? "<null>" : RefSourceRecord.TARGET_REF.get(f2) ) );
        test( f3 != null && "zzz".equals(RefSourceRecord.TARGET_REF.get(f3)),
          "unmapped ref 'zzz' left alone, got "
            + ( f3 == null ? "<null>" : RefSourceRecord.TARGET_REF.get(f3) ) );

        test( ! m.fixupDAO(tx, "missingDAO_" + System.nanoTime(), RefSourceRecord.TARGET_REF, idMap),
          "fixupDAO returns false when the referencing DAO is missing from the context" );
      `
    },
    {
      name: 'testEndToEndArchiveGatedOnFixup',
      args: 'X x',
      type: 'Void',
      documentation: 'migrateFrom(x, legacy, daoKey) migrates, rewrites discovered refs via the captured idMap, archives the legacy journal, and a second call is a no-op.',
      javaCode: `
        X tx = newStorageContext(x);
        Storage storage = (Storage) tx.get(FileSystemStorage.class);
        String legacy = "refE2E_" + System.nanoTime();

        // Legacy single-file journal: String ids "a" and "b", both bucket 5.
        DAO src = new JDAO(tx, PartitionStrRecord.getOwnClassInfo(), legacy);
        PartitionStrRecord t1 = new PartitionStrRecord(); t1.setId("a"); t1.setBucket(5); t1.setData("da"); src.put(t1);
        PartitionStrRecord t2 = new PartitionStrRecord(); t2.setId("b"); t2.setBucket(5); t2.setData("db"); src.put(t2);

        // cSpecDAO exposing the referencing DAO, and the referencing DAO itself.
        DAO cspecs = new MDAO(CSpec.getOwnClassInfo());
        CSpec sp = new CSpec();
        sp.setName("refSourceDAO");
        sp.setClient("{\\"class\\":\\"foam.dao.EasyDAO\\",\\"of\\":\\"foam.core.partition.test.RefSourceRecord\\"}");
        cspecs.put(sp);

        DAO refDAO = new MDAO(RefSourceRecord.getOwnClassInfo());
        RefSourceRecord r1 = new RefSourceRecord(); r1.setId(1L); r1.setTargetRef("a"); refDAO.put(r1);

        X tx2 = tx.put("cSpecDAO", cspecs).put("refSourceDAO", refDAO);

        PartitionedDAO target = new PartitionedDAO(
          tx2, PartitionStrRecord.getOwnClassInfo(), "refe2e" + System.nanoTime() + "/",
          PartitionStrRecord.BUCKET);
        target.migrateFrom(tx2, legacy, "partitionRefTargetDAO");

        FObject f1 = refDAO.find(1L);
        String ref = f1 == null ? null : (String) RefSourceRecord.TARGET_REF.get(f1);
        test( ref != null && ! "a".equals(ref) && ref.startsWith("5" + PartitionedDAO.SEPARATOR),
          "migrateFrom rewrote ref 'a' to the stamped partition-5 id, got " + ref );

        // The rewritten ref resolves through the partitioned target to the
        // record that WAS "a" (distinct data values prove identity).
        FObject resolved = ref == null ? null : target.find_(tx2, ref);
        test( resolved != null && "da".equals(PartitionStrRecord.DATA.get(resolved)),
          "rewritten ref resolves to record 'a''s data ('da'), got "
            + ( resolved == null ? "<null>" : PartitionStrRecord.DATA.get(resolved) ) );

        test( storage.get(legacy + ".migrated").exists(),
          "legacy journal archived to <legacy>.migrated after successful fixup" );

        // Second call: legacy is archived -> needsMigration false -> no-op.
        target.migrateFrom(tx2, legacy, "partitionRefTargetDAO");
        FObject f1b = refDAO.find(1L);
        test( f1b != null && ref != null && ref.equals(RefSourceRecord.TARGET_REF.get(f1b)),
          "second migrateFrom is a no-op (ref unchanged), got "
            + ( f1b == null ? "<null>" : RefSourceRecord.TARGET_REF.get(f1b) ) );
      `
    }
  ]
});
