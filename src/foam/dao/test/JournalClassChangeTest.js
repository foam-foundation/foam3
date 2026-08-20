/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'JournalClassChangeTest',
  extends: 'foam.core.test.Test',

  documentation: `
    Re-putting a stored record under a subclass, with every property value equal,
    must still be journaled. The delta writer counts only property differences, so
    a class-only change used to produce no entry at all and the record came back as
    the original class on replay.
  `,

  javaImports: [
    'foam.core.auth.UserLifecycleTicket',
    'foam.core.ticket.Ticket',
    'foam.dao.DAO',
    'foam.dao.MDAO',
    'foam.dao.ProxyDAO',
    'foam.lang.X',
    'foam.lib.StoragePropertyPredicate',
    'foam.lib.formatter.JSONFObjectFormatter',
    'java.util.Scanner'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        String file = "classChangeJournal";

        // Plain MDAO under the journal: no LastModifiedAware, nothing that would
        // stamp a field and give the put a property delta of its own.
        foam.dao.java.JDAO dao = new foam.dao.java.JDAO();
        dao.setX(x);
        dao.setFilename(file);
        dao.setDelegate(new MDAO(Ticket.getOwnClassInfo()));
        x = x.put("classChangeTicketDAO", new ProxyDAO.Builder(x).setDelegate(dao).build());

        Ticket base = new Ticket(x);
        base.setId("class-change-1");
        base.setTitle("same title");
        dao.put(base);

        // Same id, same values, subclass instead.
        Ticket stored = (Ticket) dao.find("class-change-1");
        UserLifecycleTicket sub = new UserLifecycleTicket(x);
        sub.copyFrom(stored);
        dao.put(sub);

        Ticket live = (Ticket) dao.find("class-change-1");
        test(live instanceof UserLifecycleTicket,
          "live record carries the subclass, got " + live.getClass().getSimpleName());

        // Formatter level, same settings the journal uses: a class-only change is a delta.
        JSONFObjectFormatter fmt = new JSONFObjectFormatter();
        fmt.setPropertyPredicate(new StoragePropertyPredicate());
        fmt.setOutputShortNames(true);
        fmt.setOutputDefaultClassNames(false);
        fmt.setX(x);
        boolean wrote = fmt.maybeOutputDelta(stored, sub, null, Ticket.getOwnClassInfo());
        test(wrote, "formatter reports a delta for a class-only change");
        test(fmt.builder().indexOf("UserLifecycleTicket") >= 0,
          "the delta names the new class, got: " + fmt.builder());

        int entries = countEntries(x, file);
        test(entries == 2,
          "the class change is journaled as a second entry, found " + entries);

        // Replay into a fresh DAO reading the same journal.
        foam.dao.java.JDAO replayed = new foam.dao.java.JDAO();
        replayed.setX(x);
        replayed.setFilename(file);
        replayed.setDelegate(new MDAO(Ticket.getOwnClassInfo()));

        Ticket after = (Ticket) replayed.find("class-change-1");
        test(after != null, "record survives the replay");
        test(after != null && after instanceof UserLifecycleTicket,
          "class survives the replay, got " + ( after == null ? "null" : after.getClass().getSimpleName() ));
        test(after != null && "same title".equals(after.getTitle()),
          "values survive the replay");
      `
    },
    {
      name: 'countEntries',
      args: 'X x, String fileName',
      type: 'Integer',
      javaCode: `
        foam.core.fs.FileSystemStorage fs = (foam.core.fs.FileSystemStorage) x.get(foam.core.fs.FileSystemStorage.class);
        int count = 0;
        try ( Scanner sc = new Scanner(fs.getInputStream(fileName)) ) {
          while ( sc.hasNextLine() ) {
            String line = sc.nextLine();
            if ( line.startsWith(foam.dao.AbstractF3FileJournal.OPEN_CREATE) ||
                 line.startsWith(foam.dao.AbstractF3FileJournal.OPEN_PUT) ) {
              count++;
            }
          }
        } catch ( Exception e ) {
          return -1;
        }
        return count;
      `
    }
  ]
});
