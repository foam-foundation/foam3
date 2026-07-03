/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'FileJournal',
  extends: 'foam.dao.AbstractFileJournal',
  flags: ['java'],

  implements: [
    'foam.dao.Journal'
  ],

  javaImports: [
    'foam.lang.FObject',
    'foam.lib.json.JSONParser',
    'foam.core.pm.PM',
    'foam.util.SafetyUtil',
    'java.io.BufferedReader'
  ],

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao'
    }
  ],

  methods: [
    {
      name: 'replay',
      documentation: 'Replays the journal file',
      args: [
        { name: 'x',   type: 'Context' },
        { name: 'dao', type: 'foam.dao.DAO' }
      ],
      javaCode: `
        // count number of entries successfully read
        int successReading = 0;
        JSONParser parser = getParser();

        // NOTE: explicitly calling PM constructor as create only creates
        // a percentage of PMs, but we want all replay statistics
        PM pm = new PM(((foam.dao.AbstractDAO)dao).getOf(), "replay."+getFilename());

        try ( BufferedReader reader = getReader() ) {
          if ( reader == null ) {
            return;
          }
          for ( String entry ; ( entry = getEntry(reader) ) != null ; ) {
            if ( SafetyUtil.isEmpty(entry) ) continue;
            // Fast comment check: every comment starts with '/', never the first
            // char of a data entry ('p'/'r'). getEntry reads line-by-line so a
            // multi-line block comment was never matched by the COMMENT regex
            // either — this charAt check is a strict superset of the single-line
            // cases the regex matched, at no per-entry Matcher allocation.
            if ( entry.charAt(0) == '/' ) continue;

            try {
              char operation = entry.charAt(0);
              int length = entry.length();
              entry = entry.substring(2, length - 1);

              FObject obj = parser.parseString(entry);
              if ( obj == null ) {
                getLogger().error("Parse error", getParsingErrorMessage(entry), "entry:", entry);
                continue;
              }

              switch ( operation ) {
                case 'p':
                  foam.lang.FObject old = dao.find(obj.getProperty("id"));
                  dao.put(old != null ? mergeFObject(old.fclone(), obj) : obj);
                  break;

                case 'r':
                  dao.remove(obj);
                  break;
              }

              successReading++;
            } catch ( Throwable t ) {
              getLogger().error("Error replaying journal entry:", entry, t);
            }
          }
        } catch ( Throwable t) {
          getLogger().error("Failed to read from journal", t);
        } finally {
          pm.log(x);
          getLogger().log("Successfully read " + successReading + " entries from file: " + getFilename() +" in: "+pm.getTime()+"(ms)");
        }
      `
    }
  ]
});
