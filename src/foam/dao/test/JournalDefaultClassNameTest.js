/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'JournalDefaultClassNameTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.auth.UserLifecycleTicket',
    'foam.core.pii.PIIReportTicket',
    'foam.core.ticket.Ticket',
    'foam.dao.AbstractF3FileJournal',
    'foam.dao.DAO',
    'foam.dao.ProxyDAO',
    'foam.lang.X',
    'static foam.mlang.MLang.COUNT',
    'foam.mlang.sink.Count',
    'foam.util.Auth',
    'java.io.*',
    'java.nio.file.*',
    'java.util.HashMap',
    'java.util.Map',
    'java.util.Scanner'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        Map<String, Integer> info = null;
        Integer count = null;

        foam.dao.java.JDAO ticketDAO = new foam.dao.java.JDAO();
        ticketDAO.setX(x);
        ticketDAO.setFilename("ticketJournal");
        ticketDAO.setDelegate(new foam.dao.FUIDDAO(x, "ticketDAO", "id", 
            new foam.core.auth.LastModifiedAwareDAO.Builder(x).setDelegate(new foam.dao.MDAO(foam.core.ticket.Ticket.getOwnClassInfo())).build()));
        x = x.put("ticketDAO", new ProxyDAO.Builder(x).setDelegate(ticketDAO).build());

        Ticket ticket = new Ticket(x);
        ticket.setTitle("ticketTicket");
        ticket = (Ticket) ticketDAO.put(ticket).fclone();

        UserLifecycleTicket ult = new UserLifecycleTicket(x);
        ult.setTitle("ticketUserLifecycleTicket");
        ult = (UserLifecycleTicket) ticketDAO.put(ult).fclone();

        PIIReportTicket prt = new PIIReportTicket(x);
        prt.setTitle("ticketPIIReportTicket");
        prt = (PIIReportTicket) ticketDAO.put(prt);

        info = (Map<String, Integer>) find(x, "ticketJournal", ticket.getClass().getName(), ult.getClass().getName(), prt.getClass().getName());

        count = info.get(AbstractF3FileJournal.OPEN_CREATE);
        test ( count != null && count.intValue() == 3, "Three create found "+count);

        count = info.get(ticket.getClass().getName());
        test ( count == null, "Ticket (default) class not found "+count);

        count = info.get(ult.getClass().getName());
        test ( count != null, "UserLifecycleTicket class found "+count);

        count = info.get(prt.getClass().getName());
        test ( count != null, "PIIReportTicket class found "+count);

        // Replay
        ticketDAO = new foam.dao.java.JDAO();
        ticketDAO.setX(x);
        ticketDAO.setFilename("ticketJournal");
        ticketDAO.setDelegate(new foam.dao.FUIDDAO(x, "ticketDAO", "id", 
            new foam.core.auth.LastModifiedAwareDAO.Builder(x).setDelegate(new foam.dao.MDAO(foam.core.ticket.Ticket.getOwnClassInfo())).build()));
        x = x.put("ticketDAO", new ProxyDAO.Builder(x).setDelegate(ticketDAO).build());
        Count c = (Count) ticketDAO.select(COUNT());
        test ( c.getValue() == 3, "Ticket replay count 3 "+c);
      `
    },
    {
      name: 'increment',
      args: 'Map map, String op',
      type: 'Map',
      javaCode: `
        Integer i = (Integer) map.get(op);
        if ( i == null ) {
          i = Integer.valueOf(1);
        } else {
          i = Integer.valueOf(i.intValue() +1);
        }
        map.put(op, i);
        return map;
      `, 
    }
  ],

  javaCode: `
    public Map find(X x, String fileName, String... matches) 
      throws java.io.IOException {

      foam.core.fs.FileSystemStorage fs = (foam.core.fs.FileSystemStorage) x.get(foam.core.fs.FileSystemStorage.class);
      Map<String, Integer> info = new HashMap();
      try ( Scanner sc = new Scanner(fs.getInputStream(fileName)) ) {
        int lineNum = 1;
        while ( sc.hasNextLine() ) {
          String line = sc.nextLine();
          if ( line.startsWith(AbstractF3FileJournal.OPEN_CREATE) )
            increment(info, AbstractF3FileJournal.OPEN_CREATE);
          else if ( line.startsWith(AbstractF3FileJournal.OPEN_PUT) )
            increment(info, AbstractF3FileJournal.OPEN_PUT);
          else if ( line.startsWith(AbstractF3FileJournal.OPEN_REMOVE) )
            increment(info, AbstractF3FileJournal.OPEN_REMOVE);

          for ( String match : matches ) {
            if ( line.indexOf(match) >= 0 )
              info.put(match, Integer.valueOf(lineNum));
          }

          lineNum += 1;
        }
      }
      return info;
    }
  `
});
