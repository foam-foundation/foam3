/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'JacksonFallbackSurveyTest',
  extends: 'foam.core.test.Test',
  flags: ['java'],

  documentation: `
    Runs JacksonJournalParser over every journal the test server loaded
    (JOURNAL_HOME/*.0) and counts, per journal, how often it returns null
    (the FOAM fallback) and how often its FObject differs from the FOAM
    parser's, property by property. Runs twice: with the nested-object
    bail-out on (the RFC behaviour) and off (mapToFObject resolves nested
    classes itself). Answers "does the fallback ever fire on real data".
  `,

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.dao.JacksonJournalParser',
    'foam.lib.json.JSONParser',
    'java.io.BufferedReader',
    'java.io.File',
    'java.io.FileReader',
    'java.util.ArrayList',
    'java.util.Iterator',
    'java.util.List',
    'java.util.TreeMap'
  ],

  javaCode: `
    static class Tally {
      int entries, noClass, ok, nullNested, nullComment, nullTriple, nullBacktick, nullOther, mismatch;
    }
    private final List<String> samples_ = new ArrayList<>();
    private final TreeMap<String, Integer> groups_ = new TreeMap<>();
    private final TreeMap<String, String> groupExample_ = new TreeMap<>();

    private void group(String key, String example) {
      groups_.merge(key, 1, Integer::sum);
      groupExample_.putIfAbsent(key, example);
    }

    private void log(String m) { System.out.println(m); }

    /** Same accumulation rule as AbstractF3FileJournal.getEntry. */
    private String readEntry(BufferedReader r) throws Exception {
      String line = r.readLine();
      if ( line == null ) return null;
      if ( ! line.equals("p({") && ! line.equals("c({") && ! line.equals("r({") ) return line;
      StringBuilder sb = new StringBuilder(line);
      while ( ! line.equals("})") ) {
        if ( (line = r.readLine()) == null ) break;
        sb.append('\\n').append(line);
      }
      return sb.toString();
    }

    private static String setProps(FObject o) {
      foam.lib.formatter.JSONFObjectFormatter f = new foam.lib.formatter.JSONFObjectFormatter();
      f.setOutputShortNames(false);
      f.output(o);
      return f.builder().toString();
    }

    private boolean sameValue(Object a, Object b) {
      try {
        return sameValue_(a, b);
      } catch (RuntimeException e) {
        // a value whose toString/compare throws (predicate with unset 'of') counts as a mismatch
        return false;
      }
    }

    private boolean sameValue_(Object a, Object b) {
      if ( a == null && b == null ) return true;
      if ( a == null || b == null ) return false;
      if ( a.equals(b) ) return true;
      if ( a instanceof Number && b instanceof Number ) return ((Number) a).longValue() == ((Number) b).longValue();
      // set properties only, so factory output (timestamps, generated ids) never counts as a difference
      if ( a instanceof FObject && b instanceof FObject ) return setProps((FObject) a).equals(setProps((FObject) b));
      if ( a.getClass().isArray() && b.getClass().isArray() )
        return java.util.Arrays.deepToString(new Object[]{a}).equals(java.util.Arrays.deepToString(new Object[]{b}));
      return false;
    }
  `,

  methods: [
    {
      name: 'runTest',
      javaThrows: ['Exception'],
      javaCode: `
        File dir = new File(System.getProperty("JOURNAL_HOME"));
        File[] files = dir.listFiles((d, n) -> n.endsWith(".0"));
        test(files != null && files.length > 0, "found journals in " + dir);
        java.util.Arrays.sort(files);

        for ( boolean bail : new boolean[] { true, false } ) {
          TreeMap<String, Tally> perJournal = new TreeMap<>();
          Tally total = new Tally();
          samples_.clear(); groups_.clear(); groupExample_.clear();
          for ( File f : files ) {
            Tally t = (Tally) survey(x, f, bail);
            if ( t.entries > 0 ) perJournal.put(f.getName(), t);
            total.entries += t.entries; total.noClass += t.noClass; total.ok += t.ok;
            total.nullNested += t.nullNested; total.nullComment += t.nullComment; total.nullTriple += t.nullTriple;
            total.nullBacktick += t.nullBacktick; total.nullOther += t.nullOther; total.mismatch += t.mismatch;
          }
          log("");
          log("## bailOnNested=" + bail);
          log("| Journal | Entries | No class | OK | Null: nested | Null: // comment | Null: triple-quote | Null: backtick | Null: other | Mismatch |");
          log("|---|---|---|---|---|---|---|---|---|---|");
          for ( java.util.Map.Entry<String, Tally> e : perJournal.entrySet() ) {
            Tally t = e.getValue();
            if ( t.ok == t.entries - t.noClass ) continue; // all clean, keep the table short
            log(String.format("| %s | %d | %d | %d | %d | %d | %d | %d | %d | %d |", e.getKey(), t.entries, t.noClass, t.ok, t.nullNested, t.nullComment, t.nullTriple, t.nullBacktick, t.nullOther, t.mismatch));
          }
          log(String.format("| **total (%d journals)** | %d | %d | %d | %d | %d | %d | %d | %d | %d |", perJournal.size(), total.entries, total.noClass, total.ok, total.nullNested, total.nullComment, total.nullTriple, total.nullBacktick, total.nullOther, total.mismatch));
          for ( String s : samples_ ) log("  " + s);
          log("");
          log("Grouped by class.property (count, then one example):");
          for ( java.util.Map.Entry<String, Integer> g : groups_.entrySet() ) {
            log("  " + g.getValue() + "x " + g.getKey());
            log("      " + groupExample_.get(g.getKey()));
          }
          test(total.entries > 0, "bailOnNested=" + bail + ": surveyed " + total.entries + " entries");
        }
      `
    },
    {
      name: 'survey',
      type: 'Object',
      args: 'Context x, java.io.File f, boolean bail',
      javaThrows: ['Exception'],
      javaCode: `
        Tally t = new Tally();
        JSONParser foam = new JSONParser();
        foam.setX(x);
        JacksonJournalParser jackson = new JacksonJournalParser();
        jackson.setBailOnNested(bail);

        try ( BufferedReader r = new BufferedReader(new FileReader(f)) ) {
          for ( String entry ; (entry = readEntry(r)) != null ; ) {
            if ( entry.length() < 3 || entry.charAt(0) == '/' || entry.charAt(0) == 'v' ) continue;
            char op = entry.charAt(0);
            if ( op != 'p' && op != 'c' && op != 'r' ) continue;
            String body = entry.substring(2, entry.length() - 1);
            t.entries++;

            FObject fo = foam.parseString(body);
            if ( fo == null ) { t.noClass++; continue; }

            jackson.setTargetClassInfo(fo.getClassInfo());
            FObject jo = jackson.parseString(body);
            if ( jo == null ) {
              boolean nested = body.indexOf('{') != body.lastIndexOf('{');
              String bucket;
              if ( body.contains("\\"\\"\\"") ) { t.nullTriple++; bucket = "triple-quote"; }
              else if ( body.indexOf('\\u0060') >= 0 ) { t.nullBacktick++; bucket = "backtick"; }
              else if ( body.contains("//") || body.contains("/*") ) { t.nullComment++; bucket = "comment"; }
              else if ( nested ) { t.nullNested++; bucket = "nested"; }
              else { t.nullOther++; bucket = "other"; }
              String why = jackson.getLastError();
              String flatBody = body.replace('\\n', ' ').replaceAll("  +", " ");
              group("NULL(" + bucket + ") — " + (why.length() > 110 ? why.substring(0, 110) : why), f.getName() + ": " + flatBody.substring(0, Math.min(220, flatBody.length())));
              continue;
            }

            List props = fo.getClassInfo().getAxiomsByClass(PropertyInfo.class);
            Iterator it = props.iterator();
            String bad = null;
            while ( it.hasNext() ) {
              PropertyInfo pi = (PropertyInfo) it.next();
              if ( pi.getStorageTransient() || pi.getNetworkTransient() ) continue;
              // a property neither parser set only holds factory output (random ids, timestamps)
              if ( ! pi.isSet(fo) && ! pi.isSet(jo) ) continue;
              if ( ! sameValue(pi.get(fo), pi.get(jo)) ) { bad = pi.getName(); break; }
            }
            if ( bad == null ) t.ok++;
            else {
              t.mismatch++;
              String flat = body.replace('\\n', ' ').replaceAll("  +", " ");
              Object fv = fo.getProperty(bad), jv = jo.getProperty(bad);
              String detail = ( fv instanceof FObject && jv instanceof FObject )
                ? "foamSet=" + setProps((FObject) fv) + " | jacksonSet=" + setProps((FObject) jv)
                : "foam=" + pi_str(fo, bad) + " | jackson=" + pi_str(jo, bad);
              group("MISMATCH " + fo.getClassInfo().getId() + "." + bad, detail + " | body=" + flat.substring(0, Math.min(400, flat.length())));
            }
          }
        }
        return t;
      `
    },
    {
      name: 'pi_str',
      type: 'String',
      args: 'FObject o, String prop',
      javaCode: `
        Object v = o.getProperty(prop);
        String s;
        try {
          s = v == null ? "null" : ( v.getClass().isArray() ? java.util.Arrays.deepToString(new Object[]{v}) : v.toString() );
        } catch (RuntimeException e) {
          s = v.getClass().getSimpleName() + "(toString threw " + e.getClass().getSimpleName() + ")";
        }
        return s.length() > 80 ? s.substring(0, 80) + "..." : s;
      `
    }
  ]
});
