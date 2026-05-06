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
  'foam.dao.ArraySink',
  'foam.dao.DAO',
  'foam.lib.parse.PStream',
  'foam.lib.parse.ParserContext',
  'foam.lib.parse.ParserContextImpl',
  'foam.lib.parse.StringPStream',
  'foam.core.auth.User',
  'foam.mlang.predicate.Nary',
  'foam.mlang.predicate.Predicate',
  'foam.parse.*',
  'java.util.Date',
  'java.time.ZoneOffset',
  'java.time.format.DateTimeFormatter',
  'java.util.TimeZone'
  ],

  javaCode: `
    protected static DateTimeFormatter dateFormat_ = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")
                                                      .withZone(ZoneOffset.UTC);
  `,

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
      test(evaluate("birthday=" + dateFormat_.format(noon.toInstant()), user), user.getBirthday() + " = "+noon.toString());

      // ── Float/Decimal parsing tests ──
      QueryParser floatParser = new QueryParser(
        foam.parse.test.QueryParserTestUser.getOwnClassInfo());

      // Decimal values should parse
      test(canParseFloat(floatParser, "amount=6.5"),        "Float: parse amount=6.5");
      test(canParseFloat(floatParser, "amount=0.10000000009999999995"), "Float: parse long decimal");
      test(canParseFloat(floatParser, "amount=0.0"),          "Float: parse 0.0");

      // Decimal comparisons
      test(canParseFloat(floatParser, "amount>6.5"),          "Float: parse amount>6.5");
      test(canParseFloat(floatParser, "amount>=6.5"),         "Float: parse amount>=6.5");
      test(canParseFloat(floatParser, "amount<6.5"),          "Float: parse amount<6.5");
      test(canParseFloat(floatParser, "amount<=6.5"),         "Float: parse amount<=6.5");

      // Negative decimals
      test(canParseFloat(floatParser, "amount>-0.10000000009999999995"), "Float: parse negative decimal");
      test(canParseFloat(floatParser, "amount<-6.5"),         "Float: parse amount<-6.5");

      // Combined with other predicates
      test(canParseFloat(floatParser, "amount>=0.1 AND firstName=John"), "Float: decimal in AND");

      // Evaluate predicates against objects with float values
      foam.parse.test.QueryParserTestUser m1 = new foam.parse.test.QueryParserTestUser();
      m1.setId(1);
      m1.setFirstName("positive");
      m1.setAmount(6.5);

      foam.parse.test.QueryParserTestUser m2 = new foam.parse.test.QueryParserTestUser();
      m2.setId(2);
      m2.setFirstName("negative");
      m2.setAmount(-3.14);

      foam.parse.test.QueryParserTestUser m3 = new foam.parse.test.QueryParserTestUser();
      m3.setId(3);
      m3.setFirstName("zero");
      m3.setAmount(0.0);

      test(evaluateFloat(floatParser, "amount>6.0", m1),     "Float: 6.5 > 6.0");
      test(!evaluateFloat(floatParser, "amount>6.0", m2),    "Float: -3.14 !> 6.0");
      test(evaluateFloat(floatParser, "amount<0.0", m2),     "Float: -3.14 < 0.0");
      test(!evaluateFloat(floatParser, "amount<0.0", m1),    "Float: 6.5 !< 0.0");
      test(evaluateFloat(floatParser, "amount>=0.0", m3),    "Float: 0.0 >= 0.0");
      test(evaluateFloat(floatParser, "amount<=0.0", m3),    "Float: 0.0 <= 0.0");
      test(evaluateFloat(floatParser, "amount>=-3.15", m2),  "Float: -3.14 >= -3.15");
      test(!evaluateFloat(floatParser, "amount>=-3.13", m2), "Float: -3.14 !>= -3.13");

      // DAO select with float predicate
      DAO dao = new foam.dao.MapDAO(
        foam.parse.test.QueryParserTestUser.getOwnClassInfo());
      dao.put(m1);
      dao.put(m2);
      dao.put(m3);

      Predicate floatPred = buildFloatPredicate(floatParser, "amount>0.0");
      if ( floatPred != null ) {
        ArraySink sink = (ArraySink) dao.where(floatPred).select(new ArraySink());
        test(sink.getArray().size() == 1, "Float DAO: amount>0.0 matches 1 record, got " + sink.getArray().size());
      }

      floatPred = buildFloatPredicate(floatParser, "amount<0.0");
      if ( floatPred != null ) {
        ArraySink sink = (ArraySink) dao.where(floatPred).select(new ArraySink());
        test(sink.getArray().size() == 1, "Float DAO: amount<0.0 matches 1 record, got " + sink.getArray().size());
      }
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
    },
    {
      name: 'buildFloatPredicate',
      type: 'foam.mlang.predicate.Predicate',
      args: [
        { name: 'parser', javaType: 'foam.parse.QueryParser' },
        { name: 'query',  type: 'String' }
      ],
      javaCode: `
        StringPStream sps = new StringPStream();
        sps.setString(query);
        PStream ps = sps;
        ParserContext px = new ParserContextImpl();
        ps = parser.parse(ps, px);
        if ( ps == null ) return null;
        Predicate pred = (Predicate) ps.value();
        return pred.partialEval();
      `
    },
    {
      name: 'canParseFloat',
      type: 'Boolean',
      args: [
        { name: 'parser', javaType: 'foam.parse.QueryParser' },
        { name: 'query',  type: 'String' }
      ],
      javaCode: `
        try {
          return buildFloatPredicate(parser, query) != null;
        } catch ( Exception e ) {
          return false;
        }
      `
    },
    {
      name: 'evaluateFloat',
      type: 'Boolean',
      args: [
        { name: 'parser', javaType: 'foam.parse.QueryParser' },
        { name: 'query',  type: 'String' },
        { name: 'obj',    type: 'FObject' }
      ],
      javaCode: `
        try {
          Predicate pred = buildFloatPredicate(parser, query);
          if ( pred == null ) return false;
          return pred.f(obj);
        } catch ( Exception e ) {
          return false;
        }
      `
    }
  ]
});
