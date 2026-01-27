/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'F3FileJournalTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.auth.*',
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
        X testX = x;

        Map<String, Integer> info = null;
        Integer count = null;

        // Single property ID, implements LastModifiedBy
        foam.dao.java.JDAO userDAO = new foam.dao.java.JDAO();
        userDAO.setX(x);
        userDAO.setFilename("userJournal");
        userDAO.setDelegate(new foam.dao.FUIDDAO(x, "userDAO", "id", 
            new foam.core.auth.LastModifiedAwareDAO.Builder(x).setDelegate(new foam.dao.MDAO(foam.core.auth.User.getOwnClassInfo())).build()));
        x = x.put("userDAO", new ProxyDAO.Builder(x).setDelegate(userDAO).build());

        User user = new User(x);
        user.setFirstName("test1FirstName");
        user.setLastName("test1LastName");
        user = (User) userDAO.put(user).fclone();

        // create
        // expect 2 lines: 1 // version, 2 c({ })
        info = (Map<String, Integer>) find(x, "userJournal", user.getFirstName());
        count = info.get(AbstractF3FileJournal.OPEN_VERSION);
        test ( count != null && count.intValue() == 1, "User CREATE - One version found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_CREATE);
        test ( count != null && count.intValue() == 1, "User CREATE - One create found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_PUT);
        test ( count == null, "User CREATE - No put found "+count);

        count = info.get(user.getFirstName());
        test ( count != null && count.intValue() == 2, "User CREATE - User firstName found on line 2 "+count);

        user.setUserName("test1UserName");
        user = (User) userDAO.put(user).fclone();

        info = (Map<String, Integer>) find(x, "userJournal", user.getFirstName(), user.getUserName());
        count = info.get(AbstractF3FileJournal.OPEN_VERSION);
        test ( count != null && count.intValue() == 1, "User UPDATE - One version found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_CREATE);
        test ( count != null && count.intValue() == 1, "User UPDATE - One create found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_PUT);
        test ( count != null && count.intValue() == 1, "User UPDATE - One put found "+count);

        count = info.get(user.getFirstName());
        test ( count != null && count.intValue() == 2, "User UPDATE - User firstName found on line 2 "+count);

        count = info.get(user.getUserName());
        test ( count != null && count.intValue() == 3, "User UPDATE - User userName found on line 3 "+count);

        user = new User(x);
        user.setFirstName("test2FirstName");
        user.setLastName("test2LastName");
        user = (User) userDAO.put(user).fclone();
        user.setUserName("test2UserName");
        user = (User) userDAO.put(user).fclone();

        info = (Map<String, Integer>) find(x, "userJournal", user.getFirstName(), user.getUserName());
        count = info.get(AbstractF3FileJournal.MODIFIED_BY);
        test ( count == null, "User 2 - No Modified by found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_VERSION);
        test ( count != null && count.intValue() == 1, "User 2 - One version found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_CREATE);
        test ( count != null && count.intValue() == 2, "User 2 - Two create found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_PUT);
        test ( count != null && count.intValue() == 2, "User 2 - Two put found "+count);

        count = info.get(user.getFirstName());
        test ( count != null && count.intValue() == 4, "User 2 - User firstName found on line 4 "+count);

        count = info.get(user.getUserName());
        test ( count != null && count.intValue() == 5, "User 2 - User userName found on line 5 "+count);

        info = (Map<String, Integer>) find(x, "userJournal", user.getFirstName(), user.getUserName());

        // Replay
        userDAO = new foam.dao.java.JDAO();
        userDAO.setX(x);
        userDAO.setFilename("userJournal");
        userDAO.setDelegate(new foam.dao.FUIDDAO(x, "userDAO", "id", 
            new foam.core.auth.LastModifiedAwareDAO.Builder(x).setDelegate(new foam.dao.MDAO(foam.core.auth.User.getOwnClassInfo())).build()));
        Count c = (Count) userDAO.select(COUNT());
        test ( c.getValue() == 2, "User replay count 2 "+c);


        // Multipart ID
        foam.dao.java.JDAO languageDAO = new foam.dao.java.JDAO();
        languageDAO.setX(x);
        languageDAO.setFilename("languageJournal");
        languageDAO.setDelegate(new foam.dao.MDAO(foam.core.auth.Language.getOwnClassInfo()));
        x = x.put("languageDAO", new ProxyDAO.Builder(x).setDelegate(languageDAO).build());

        Language language = new Language(x);
        language.setCode("aaCode");
        language.setVariant("aaVariant");
        language = (Language) languageDAO.put(language);

        info = (Map<String, Integer>) find(x, "languageJournal", language.getCode());
        count = info.get(AbstractF3FileJournal.OPEN_VERSION);
        test ( count != null && count.intValue() == 1, "Language CREATE - One version found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_CREATE);
        test ( count != null && count.intValue() == 1, "Language CREATE - One create found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_PUT);
        test ( count == null, "Language CREATE - No put found "+count);

        count = info.get(language.getCode());
        test ( count != null && count.intValue() == 2, "Language CREATE - Language code found on line 2 "+count);

        language.setName("aaName");
        language = (Language) languageDAO.put(language).fclone();

        info = (Map<String, Integer>) find(x, "languageJournal", language.getCode(), language.getName());
        count = info.get(AbstractF3FileJournal.MODIFIED_BY);
        test ( count == null, "Language UPDATE - No Modified by found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_VERSION);
        test ( count != null && count.intValue() == 1, "Language UPDATE - One version found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_CREATE);
        test ( count != null && count.intValue() == 1, "Language UPDATE - One create found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_PUT);
        test ( count != null && count.intValue() == 1, "Language UPDATE - One put found "+count);

        // line 3 as code is part of id
        count = info.get(language.getCode());
        test ( count != null && count.intValue() == 3, "Language UPDATE - Language code found on line 3 "+count);

        count = info.get(language.getName());
        test ( count != null && count.intValue() == 3, "Language UPDATE - Language languageName found on line 3 "+count);

        // become test user to trigger modifiedby
        X y = Auth.sudo(testX, 185426801L);
        language = new Language(y);
        language.setCode("bbCode");
        language.setVariant("bbVariant");
        language = (Language) languageDAO.put_(y, language).fclone();
        language.setName("bbName");
        try {
          // AbstractF3FileJournal.writeComment suppresses comment for
          // calls in the same millisecond
          Thread.currentThread().sleep(100L);
        } catch (InterruptedException e) {
          // nop
        }
        language = (Language) languageDAO.put_(y, language).fclone();

        info = (Map<String, Integer>) find(x, "languageJournal", language.getCode(), language.getName());
        count = info.get(AbstractF3FileJournal.MODIFIED_BY);
        test ( count != null && count.intValue() == 2, "Language 2 - Two Modified by found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_VERSION);
        test ( count != null && count.intValue() == 1, "Language 2 - One version found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_CREATE);
        test ( count != null && count.intValue() == 2, "Language 2 - Two create found "+count);

        count = info.get(AbstractF3FileJournal.OPEN_PUT);
        test ( count != null && count.intValue() == 2, "Language 2 - Two put found "+count);

        // Replay
        languageDAO = new foam.dao.java.JDAO();
        languageDAO.setX(x);
        languageDAO.setFilename("languageJournal");
        languageDAO.setDelegate(new foam.dao.MDAO(foam.core.auth.Language.getOwnClassInfo()));
        c = (Count) languageDAO.select(COUNT());
        test ( c.getValue() == 2, "Language replay count 2 "+c);

        // Remove 
        languageDAO.remove(language);
        languageDAO = new foam.dao.java.JDAO();
        languageDAO.setX(x);
        languageDAO.setFilename("languageJournal");
        languageDAO.setDelegate(new foam.dao.MDAO(foam.core.auth.Language.getOwnClassInfo()));
        c = (Count) languageDAO.select(COUNT());
        test ( c.getValue() == 1, "Language replay count 1 after remove "+c);

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
          if ( line.startsWith(AbstractF3FileJournal.OPEN_VERSION) )
            increment(info, AbstractF3FileJournal.OPEN_VERSION);
          else if ( line.startsWith(AbstractF3FileJournal.OPEN_CREATE) )
            increment(info, AbstractF3FileJournal.OPEN_CREATE);
          else if ( line.startsWith(AbstractF3FileJournal.OPEN_PUT) )
            increment(info, AbstractF3FileJournal.OPEN_PUT);
          else if ( line.startsWith(AbstractF3FileJournal.OPEN_REMOVE) )
            increment(info, AbstractF3FileJournal.OPEN_REMOVE);
          else if ( line.startsWith(AbstractF3FileJournal.MODIFIED_BY) )
            increment(info, AbstractF3FileJournal.MODIFIED_BY);

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
