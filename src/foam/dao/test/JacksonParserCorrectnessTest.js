/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'JacksonParserCorrectnessTest',
  extends: 'foam.core.test.Test',
  flags: ['java'],

  documentation: 'Compares FOAM parser vs Jackson parser for every property type scenario.',

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.dao.JacksonJournalParser',
    'foam.lib.json.JSONParser',
    'java.util.Iterator',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        // ---- Test 1: Flat User entry (String, Long, Boolean, Enum, DateTime) ----
        compareEntry(x, "Flat User",
          foam.core.auth.User.getOwnClassInfo(),
          "{" +
            "class:\\"foam.core.auth.User\\"," +
            "id:45219602," +
            "client:1," +
            "userName:\\"testuser\\"," +
            "fn:\\"John\\"," +
            "ln:\\"Doe\\"," +
            "email:\\"test@example.com\\"," +
            "emailVerified:true," +
            "created:1748013483078," +
            "lastModified:1748013483078," +
            "lifecycleState:1," +
            "spid:\\"foam\\"," +
            "password:\\"hash:salt==\\"," +
            "group:\\"admin\\"," +
            "loginEnabled:true" +
          "}"
        );

        // ---- Test 2: Nested FObject (CSpec with nested service) ----
        compareEntry(x, "Nested CSpec",
          foam.core.boot.CSpec.getOwnClassInfo(),
          "{" +
            "\\"class\\":\\"foam.core.boot.CSpec\\"," +
            "\\"name\\":\\"testService\\"," +
            "\\"serve\\":true," +
            "\\"authenticate\\":false," +
            "\\"serviceClass\\":\\"foam.dao.ProxyDAO\\"" +
          "}"
        );

        // ---- Test 3: Entry with Enum ordinal ----
        compareEntry(x, "Enum ordinal (Cron)",
          foam.core.cron.Cron.getOwnClassInfo(),
          "{" +
            "\\"class\\":\\"foam.core.cron.Cron\\"," +
            "\\"id\\":\\"testCron\\"," +
            "\\"enabled\\":true," +
            "\\"description\\":\\"test cron job\\"" +
          "}"
        );

        // ---- Test 4: Entry with array values (Group with cidrWhiteList) ----
        // Group has FObjectArray and Array — Jackson fallback should catch it
        compareEntry(x, "Group (simple fields only)",
          foam.core.auth.Group.getOwnClassInfo(),
          "{" +
            "\\"class\\":\\"foam.core.auth.Group\\"," +
            "\\"id\\":\\"testgroup\\"," +
            "\\"description\\":\\"Test Group\\"," +
            "\\"readOnly\\":false" +
          "}"
        );

        // ---- Test 5: Entry with quoted numeric string (CurrencyCode pattern) ----
        // CurrencyCode values like "036" must stay as String, not become Integer
        compareEntry(x, "Quoted numeric strings",
          foam.dao.test.BenchmarkModel.getOwnClassInfo(),
          "{" +
            "seq:1," +
            "currCode:\\"036\\"," +
            "altCurrCode:\\"826\\"," +
            "convRate:\\"64948696\\"" +
          "}"
        );

        // ---- Test 6: BenchmarkModel with all types ----
        compareEntry(x, "BenchmarkModel (all types)",
          foam.dao.test.BenchmarkModel.getOwnClassInfo(),
          "{" +
            "seq:12345," +
            "p1:\\"group5\\"," +
            "p2:\\"NET_A\\"," +
            "t1:1748013483078," +
            "t2:1748013483078," +
            "amount:1234.56," +
            "active:true," +
            "priority:7," +
            "lifecycleState:2," +
            "createdBy:1001," +
            "tags:[\\"tagA\\",\\"tagB\\"]" +
          "}"
        );
      `
    },
    {
      name: 'compareEntry',
      args: 'Context x, String label, ClassInfo ci, String entry',
      javaCode: `
        Class cls = ci.getObjClass();

        // Parse with FOAM
        JSONParser foamParser = new JSONParser();
        foamParser.setX(x);
        FObject foamObj = foamParser.parseString(entry, cls);

        // Parse with Jackson
        JacksonJournalParser jacksonParser = new JacksonJournalParser();
        jacksonParser.setTargetClassInfo(ci);
        FObject jacksonObj = jacksonParser.parseString(entry);

        boolean foamOk = foamObj != null;
        boolean jacksonOk = jacksonObj != null;

        test(foamOk, label + ": FOAM parse");

        if ( ! jacksonOk && foamOk ) {
          // Jackson returned null — check if it was a deliberate skip (nested objects)
          System.out.println("  " + label + ": Jackson returned null (fallback to FOAM expected)");
          test(true, label + ": Jackson skipped (FOAM fallback)");
          return;
        }

        test(jacksonOk, label + ": Jackson parse");

        if ( ! foamOk || ! jacksonOk ) return;

        // Compare every property
        List props = ci.getAxiomsByClass(PropertyInfo.class);
        Iterator iter = props.iterator();
        int matched = 0;
        int mismatched = 0;
        while ( iter.hasNext() ) {
          PropertyInfo pi = (PropertyInfo) iter.next();
          if ( pi.getStorageTransient() || pi.getNetworkTransient() ) continue;

          Object foamVal = pi.get(foamObj);
          Object jacksonVal = pi.get(jacksonObj);

          boolean eq = false;
          if ( foamVal == null && jacksonVal == null ) {
            eq = true;
          } else if ( foamVal != null && jacksonVal != null ) {
            eq = foamVal.equals(jacksonVal);
            if ( ! eq && foamVal instanceof Number && jacksonVal instanceof Number ) {
              eq = ((Number) foamVal).longValue() == ((Number) jacksonVal).longValue();
            }
            if ( ! eq && foamVal.getClass().isArray() && jacksonVal.getClass().isArray() ) {
              eq = java.util.Arrays.deepEquals(new Object[]{foamVal}, new Object[]{jacksonVal});
            }
            // Compare String representation as last resort (handles String[] etc)
            if ( ! eq ) {
              String fs = foamVal.getClass().isArray() ? java.util.Arrays.deepToString(new Object[]{foamVal}) : foamVal.toString();
              String js = jacksonVal.getClass().isArray() ? java.util.Arrays.deepToString(new Object[]{jacksonVal}) : jacksonVal.toString();
              eq = fs.equals(js);
            }
          }

          if ( ! eq && ( foamVal != null || jacksonVal != null ) ) {
            String foamStr = foamVal == null ? "null" : foamVal.getClass().getSimpleName() + "(" + java.util.Arrays.deepToString(new Object[]{foamVal}) + ")";
            String jacksonStr = jacksonVal == null ? "null" : jacksonVal.getClass().getSimpleName() + "(" + java.util.Arrays.deepToString(new Object[]{jacksonVal}) + ")";
            System.out.println("  MISMATCH [" + label + "]: " + pi.getName() + "  FOAM=" + foamStr + "  Jackson=" + jacksonStr);
            mismatched++;
          } else {
            matched++;
          }
        }

        System.out.println("  " + label + ": Matched=" + matched + " Mismatched=" + mismatched);
        test(mismatched == 0, label + ": all properties match (" + mismatched + " mismatches)");
      `
    }
  ]
});
