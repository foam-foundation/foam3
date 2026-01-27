/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'QueryParserUserTest',
  extends: 'foam.core.test.Test',
  
  javaImports: [
  'foam.lib.parse.PStream',
  'foam.lib.parse.ParserContext',
  'foam.lib.parse.ParserContextImpl',
  'foam.lib.parse.StringPStream',
  'foam.core.auth.User',
  'foam.mlang.predicate.Nary',
  'foam.mlang.predicate.Predicate',
  'foam.parse.*',
  'java.util.Date',
  'java.text.SimpleDateFormat',
  'java.util.TimeZone'
  ],

  javaCode: `
  protected final static ThreadLocal<SimpleDateFormat> dateFormat_ = ThreadLocal.withInitial(() -> {
    SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm");
    sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
    return sdf;
  });`,

  methods: [
    {
      name: 'runTest',
      javaCode: `
      // Just parse the query to get the predicate without evaluation.
      test( isValid("id=6", " id =  ?  ") , "The id equal to the value");
      test( isValid("-id=6"," id <>  ?  ") , "The id is Not equal to the value");
      test( isValid("Not id=6"," id <>  ?  ") , "The id is Not equal to the value '- Symbol' ");
      test( isValid("id>20"," id >  ?  ") , "The id is greater than the value");
      test( isValid("id<20"," id <  ?  ") , "The id is less than the value");
      test( isValid("id>=20"," id >=  ?  ") , "The id is greater than or equal to the value");
      test( isValid("id<=20"," id <=  ?  ") , "The id is less than the value");
      test( isValid("id-after:20"," id >=  ?  ") , "The id is greater than value 'after'");
      test( isValid("id-before:20"," id <=  ?  ") , "The id is less than value 'before'");
      test( isValid("firstName=Simon"," firstname =  ?  ") , "The firstname is equal to value");
      test( isValid("firstName:Sim"," 'firstname' like '% ? %' ") , "The firstname that contains the value");
      test( isValid("firstName:Sim,Kol"," ( 'firstname' like '% ? %' )  OR  ( 'firstname' like '% ? %' ) ") , "The firstname that contains the value or the value");
      test( isValid("firstName:(Sim|Kol)"," ( 'firstname' like '% ? %' )  OR  ( 'firstname' like '% ? %' ) ") , "The firstname that contains the value or the value");

      test( isValid("birthday=2020/09/10"," ( birthday >=  ?  )  AND  ( birthday <=  ?  ) ") , "The birthday equal to value yyyy/mm/dd");
      test( isValid("birthday=2020-09-10"," ( birthday >=  ?  )  AND  ( birthday <=  ?  ) ") , "The birthday equal to value yyyy-mm-dd");
      test( isValid("birthday<2020-09-10"," birthday <  ?  ") , "The birthday less than the value");
      test( isValid("birthday<=2020-09-10"," birthday <=  ?  ") , "The birthday less than or equal to the value");
      test( isValid("birthday>2020-09-10"," birthday >  ?  ") , "The birthday greater than the value");
      test( isValid("birthday=2011"," ( birthday >=  ?  )  AND  ( birthday <=  ?  ) ") , "The birthday year is equal to the value");
      test( isValid("birthday=2020"," ( birthday >=  ?  )  AND  ( birthday <=  ?  ) ") , "The birthday year is equal to the value");
      test( isValid("lastLogin=today"," ( lastlogin >=  ?  )  AND  ( lastlogin <=  ?  ) ") , "The lastLogin equal to today");
      test( isValid("lastLogin=today-2"," ( lastlogin >=  ?  )  AND  ( lastlogin <=  ?  ) ") , "The lastLogin equal to two day ago");
      test( isValid("lastLogin=2010-9-10..2020-9-10"," ( lastlogin >=  ?  )  AND  ( lastlogin <=  ?  ) ") , "The lastLogin between two date");
      
      test( isValid("id=6 or firstName=Simon"," ( id =  ?  )  OR  ( firstname =  ?  ) ") , "The id is equal to value1 OR the firstName is equal to value2");

      test( isValid("-id=6 | firstName=Simon"," ( id <>  ?  )  OR  ( firstname =  ?  ) ") , "The id is not equal to value1 OR the firstName is equal to value2");
      test( isValid("firstName=abc or id=20"," ( firstname =  ?  )  OR  ( id =  ?  ) ") , "The firstName is equal to value1 OR the id is equal to value2");
      test( isValid("firstName=abc and id=20"," ( firstname =  ?  )  AND  ( id =  ?  ) ") , "The firstName is equal to value1 AND the id is equal to value2");
      test( isValid("id=20 and firstName=adam11 OR id<5 and firstName=john"," ( ( id =  ?  )  AND  ( firstname =  ?  ) )  OR  ( ( id <  ?  )  AND  ( firstname =  ?  ) ) ") , "(The id is equal to value1 AND the firstName is equal to value2) OR (the id is less than the value3 AND the firstName is equal to value4)");
      test( isValid("id=20 firstName=adam11 OR id<5 firstName=john"," ( ( id =  ?  )  AND  ( firstname =  ?  ) )  OR  ( ( id <  ?  )  AND  ( firstname =  ?  ) ) ") , "(The id is equal to value1 AND 'whitespace' the firstName is equal to value2) OR (the id is less than the value3 AND 'whitespace' the firstName is equal to value4)");

      // TODO:
      test( isValid("((id<30) or (id>20))"," ( id <  ?  )  OR  ( id >  ?  ) ") , "((The id is less than the value1) OR (the id is greater than the value2))");
      test( isValid("(id<30 or id>20)"," ( id <  ?  )  OR  ( id >  ?  ) ") , "(The id is less than the value1 OR the id is greater than the value2)");
      //          {"(((id<30) or (id>20)) and ((firstName=john) or (id>20)))"," ( ( ( ( ( ( ( ( id <  ?  ) ) ) )  OR  ( ( ( ( id >  ?  ) ) ) ) )  AND  ( ( ( firstname =  ?  ) ) ) ) ) ) "},//Not supported
      test( isValid("(id=20)"," id =  ?  ") , "(The id is equal to the value)");
      test( isValid("(firstName=adam)"," firstname =  ?  ") , "(The firstName is equal to value)");
      test( isValid("((firstName=abc and id=20) or (firstName=abc and id=20))"," ( ( firstname =  ?  )  AND  ( id =  ?  ) )  OR  ( ( firstname =  ?  )  AND  ( id =  ?  ) ) ") , "((The firstName is equal to value1 AND the id is equal to value2) OR (the firstName is equal to value3 AND the id is equal to value4))");
      test( isValid("(firstName=adam)"," firstname =  ?  ") , "(The firstName is equal to value)");
      test( isValid("firstName=adam11 and id=20 or firstName=john id=5"," ( ( firstname =  ?  )  AND  ( id =  ?  ) )  OR  ( ( firstname =  ?  )  AND  ( id =  ?  ) ) ") , "(the firstName is equal to value1 AND the id is equal to value2) OR (the firstName is equal to value3 AND the id is equal to value4)");
      
      test( isValid("has:businessName"," (businessname <> '') is not true ") , "The businessName exist");
      test( isValid("is:emailVerified"," emailverified =  ?  ") , "The emailVerified is equal to true");

      // Email with + (plus addressing) - verify full email is captured, not truncated at +
      var emailUser = new User();
      emailUser.setEmail("user+tag@example.com");
      test( evaluate("email=user+tag@example.com", emailUser), "Email with + should match user with that email");
      test( !evaluate("email=user", emailUser), "Truncated email (without +tag) should NOT match - if this fails, + is not in CHAR rule");

      //          {"id=me"," ( ( id =  ?  ) ) "},
      
      test( isValid("firstName=Simon,Wassim"," ( firstname =  ?  )  OR  ( firstname =  ?  ) ") , "The firstName is equal to value1 OR to value2");
      //          {"id=(6|7)"," ( ( ( id =  ?  )  OR  ( id =  ?  ) ) ) "},
      //          {"id=(6|7)"," ( ( ( id =  ?  )  OR  ( id =  ?  ) ) ) "},//TODO add alises

      // Parse query and evaluate predicates on user
      var user = new User();
      user.setFirstName("senorita");
      user.setMiddleName("senorita");
      user.setLastName("alice");
      user.setBirthday(new Date(2323223232L)); // Tue Jan 27 21:20:23 GMT 1970
      // should convert to noon
      Date noon = new Date(2289600000L);

      // test user's birthday is between two timestamps
      test(evaluate("birthday=" + dateFormat_.get().format(noon), user), user.getBirthday() + " = "+noon.toString());
      `
    },
    {
      name: 'buildPredicate',
      type: 'foam.mlang.predicate.Predicate',
      args: [
        { name: 'query', type: 'String' }
      ],
      javaCode: `
        QueryParser parser = new QueryParser(User.getOwnClassInfo());
        StringPStream sps = new StringPStream();
        sps.setString(query);
        PStream ps = sps;
        ParserContext x = new ParserContextImpl();
        ps = parser.parse(ps, x);
        return ps == null ? null : (foam.mlang.predicate.Nary) ps.value();
  `
    },
    {
      name: 'isValid',
      type: 'Boolean',
      args: [
        { name: 'query',type: 'String' },
        { name: 'statement',type: 'String' }
      ],
      javaCode: `
        Predicate result = buildPredicate(query);
        if (result == null) return false;
        result = result.partialEval();
        return statement.equalsIgnoreCase(result.createStatement()) ? true : false;
        `
    },
    {
      name: 'evaluate',
      type: 'Boolean',
      args: [
        { name: 'query',type: 'String' },
        { name: 'user',type: 'foam.core.auth.User' }
      ],
      javaCode: `
        Predicate predicate = buildPredicate(query);
        if (predicate == null) return false;
        return predicate.f(user);
      `
    }
  ]
});
