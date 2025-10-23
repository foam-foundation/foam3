/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.test',
  name: 'FScriptParserTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'java.text.SimpleDateFormat',
    'foam.lang.X',
    'foam.lib.parse.LiteralIC',
    'foam.lib.parse.PStream',
    'foam.lib.parse.ParserContext',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.StringPStream',
    'foam.mlang.Constant',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.Expr',
    'foam.core.auth.Address',
    'foam.core.ruler.Rule',
    'foam.parse.FScriptParser',
    'java.util.Date',
    'java.util.ArrayList',
    'java.util.List',
    'java.time.LocalDate',
    'java.time.LocalDateTime',
    'java.time.ZoneId'
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
    var user = new FScriptParserTestUser();
    user.setId(100L);
    user.setFirstName("marmelad");
    user.setMiddleName("marmelad");
    user.setLastName("sonya");
    user.setOrganization("name-with-dashes");

    var addr = new Address();
    addr.setRegionId("CA-ON");

    StringPStream sps    = new StringPStream();
    PStream ps = sps;
    ParserContext px = new ParserContextImpl();

    var parser = FScriptParser.create(FScriptParserTestUser.FIRST_NAME);
    sps.setString("address==null");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "address==null");
    user.setAddress(addr);

    sps.setString("firstName==\\"marmelad\\"");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "firstName==\\"marmelad\\"");
    sps.setString("firstName==\\"kristina2\\"");
    test(! ((Predicate) parser.parse(sps, px).value()).f(user), "quoted string kristina2 returns false");
    sps.setString("thisValue.len==8");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "thisValue.len==8");

    sps.setString("lastname.len*unknown==null");
    test(parser.parse(sps, px)==null, "lastname.len*unknown==null");

    sps.setString("thisValue.len == 8");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "whitespace test: thisValue.len == 8");

    sps.setString("thisValue.len ==8");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "whitespace test: thisValue.len ==8");

    sps.setString("thisValue.len== 8");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "whitespace test: thisValue.len== 8");

    sps.setString("thisValue.len== 8 && thisValue.len > 5");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "thisValue.len== 8 && thisValue.len > 5");

    sps.setString("thisValue.len== 9 || thisValue.len > 5");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "thisValue.len== 9 || thisValue.len > 5");

    sps.setString("firstName.len!=9");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "firstName.len!=9");
    sps.setString("firstName.len>9");
    test(! ((Predicate) parser.parse(sps, px).value()).f(user), "firstName.len>9");
    sps.setString("firstName.len<8");
    test(! ((Predicate) parser.parse(sps, px).value()).f(user), "firstName.len<8");
    sps.setString("thisValue.len>=8");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "thisValue.len>=8");
    sps.setString("firstName==lastName");
    test(! ((Predicate) parser.parse(sps, px).value()).f(user), "firstName==lastName");
    sps.setString("firstName==middleName");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "firstName==middleName");
    sps.setString("firstName exists");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "firstName exists");
    sps.setString("firstName !exists");
    test(! ((Predicate) parser.parse(sps, px).value()).f(user), "firstName !exists");

    sps.setString("userName !exists||firstName !exists");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "sps.setString(\\"userName !exists||firstName !exists\\")");

    sps.setString("firstName==\\"marmelad\\"&&firstName.len!=9&&userName !exists||firstName !exists");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "&&firstName.len!=9&&userName !exists||firstName !exists");

    sps.setString("firstName.len!=9&&(userName !exists||firstName !exists)");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "firstName.len!=9&&(userName !exists||firstName !exists)");

    sps.setString("firstName==\\"marmelad\\"&&firstName.len!=9&&userName !exists&&firstName !exists");
    test(! ((Predicate) parser.parse(sps, px).value()).f(user), "&&firstName.len!=9&&userName !exists&&firstName !exists");

    sps.setString("firstName==\\"marmelad\\"&&firstName.len==9||firstName.len==8");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "&&firstName.len!=9&&userName !exists&&firstName !exists");

    sps.setString("!(firstName==\\"marmelad\\"&&firstName.len!=9&&userName !exists&&firstName !exists)");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "&&firstName.len!=9&&userName !exists&&firstName !exists");

    sps.setString("!(firstName~/[0-9]/)");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "!(firstName~/[0-9]/)");

    sps.setString("firstName~/[a-z]+/");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "firstName~/[a-z]+/");

    sps.setString("organization exists");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "organization exists");

    sps.setString("organization==\\"name-with-dashes\\"");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "organization==\\"name-with-dashes\\"");
    sps.setString("firstName~/[a-z]+/i");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "firstName~/[a-z]+/");

    sps.setString("firstName~/[a-z]+/im");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "firstName~/[a-z]+/");

    sps.setString("address isValid");
    test(! ((Predicate) parser.parse(sps, px).value()).f(user), "!address isValid");

    sps.setString("4+7");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==11, "4+7");

    sps.setString("id+lastName.len");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==105, "id+lastname.len=105");

    sps.setString("firstName.len+lastName.len==13");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "firstName.len+lastName.len=13");

    sps.setString("MAX(firstName.len,lastName.len)+5 == 13");
    test((((Predicate) parser.parse(sps, px).value()).f(user)), "MAX(firstName.len,lastName.len)+5 == 13");

    sps.setString("2+ MIN(firstName.len,lastName.len) == 7");
    test((((Predicate) parser.parse(sps, px).value()).f(user)), "2+ MIN(firstName.len,lastName.len) == 7");

    sps.setString("10 + MAX(firstName.len,MAX(lastName.len+4, 7)) == 19");
    test((((Predicate) parser.parse(sps, px).value()).f(user)), "M10 + MAX(firstName.len,MAX(lastName.len+4, 7)) == 19");

    sps.setString("10 + MIN(firstName.len,MAX(lastName.len+4, 7)) == 18");
    test((((Predicate) parser.parse(sps, px).value()).f(user)), "M10 + MAX(firstName.len,MAX(lastName.len+4, 7)) == 19");

    sps.setString("1295100+(0.15*1439800)+14292+52497+19305");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==1597164, "1597164");

    sps.setString("4+7-2");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==9, "9");

    sps.setString("4+7*2");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==18, "18");

    sps.setString("4+7*2");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==18, "18");

    sps.setString("id*lastName.len");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==500, "id*lastname.len=500");

    sps.setString("unknown*lastName.len");
    test(parser.parse(sps, px) == null, "unknown*lastname.len=null");

    sps.setString("lastName.len*unknown");
    test(parser.parse(sps, px) == null, "lastname.len*unknown=null");

    sps.setString("4+7/7");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==5, "5");

    sps.setString("4+7/7*8/4*2*3");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==16, "16");

    sps.setString("(20+5)*2-10");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==40, "40");

    sps.setString("50/10-2");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==3, "3");

    sps.setString("2*8-6");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==10, "10");

    sps.setString("2 * 8 - 6");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==10, "10");

    sps.setString("100-(2+8)-MAX(6,10)");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==80, "100-(2+8)-MAX(6,10)==80");

    sps.setString("2 * 8 - MAX(6,10)");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==6, "6");

    sps.setString("MAX(firstName.len,lastName.len)");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==8, "MAX(firstname.len,lastname.len)=8");

    sps.setString("2 * 8 - MIN(6,10)");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==10, "10");

    sps.setString("MIN(id,firstName.len)");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==8, "MIN(id,lastname.len)=8");

    double ans = 2.2*3-1;
    sps.setString("2.2*3-1");
    test(((Double)((Expr) parser.parse(sps, px).value()).f(user))==ans, "double: 5.6");

    addr.setCountryId("CA");
    addr.setCity("Toronto");
    addr.setPostalCode("m5v0j8");
    addr.setStreetName("sesame");
    addr.setStreetNumber("ed");
    addr.setRegionId("CA-ON");

    sps.setString("address isValid");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "address isValid");

    //TODO: check for no valid - address

    user.setBirthday(new Date(2323223232L));
    var today = new Date();
    var oldDate = new Date(0);

    sps.setString("birthday<" + new SimpleDateFormat("yyyy-MM-dd").format(today));
    test(((Predicate) parser.parse(sps, px).value()).f(user), "birthday<"+today.toString());

    sps.setString("birthday>" + new SimpleDateFormat("yyyy-MM-dd").format(oldDate));
    test(((Predicate) parser.parse(sps, px).value()).f(user), "birthday>"+today.toString());

    var birthday = Date.from(LocalDate.now().minusYears(20).atStartOfDay(ZoneId.systemDefault()).toInstant());
    user.setBirthday(birthday);

    sps.setString("YEARS(birthday) > 18");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "YEARS(now-20y)>18");

    sps.setString("YEARS(birthday) == 20");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "YEARS(now-20y)==20");

    sps.setString("YEARS(birthday) < 21");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "YEARS(now-20y)<21");

    // just under 20 years
    birthday = Date.from(LocalDate.now().minusYears(20).plusMonths(1).atStartOfDay(ZoneId.systemDefault()).toInstant());
    user.setBirthday(birthday);

    sps.setString("YEARS(birthday) == 19");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "YEARS(now-(20y +1m))==19");

    var month = Date.from(LocalDate.now().minusMonths(14).atStartOfDay(ZoneId.systemDefault()).toInstant());
    user.setBirthday(month);

    sps.setString("MONTHS(birthday) == 14");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "MONTHS(now - 14m)==14");

    sps.setString("DAYS(birthday) >= 425 && DAYS(birthday) <= 428");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "DAYS(now - 14m)~=425 through 428");

    month = Date.from(LocalDate.now().minusMonths(14).plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant());
    user.setBirthday(month);

    sps.setString("MONTHS(birthday) == 13");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "MONTHS(now - 14m + 1d)==13");

    var day = Date.from(LocalDate.now().minusDays(365).atStartOfDay(ZoneId.systemDefault()).toInstant());
    user.setBirthday(day);

    sps.setString("DAYS(birthday) == 365");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "DAYS(now - 365d)==365");

    // Use created for HOURS and MINUTES as need a DateTime property
    var hour = Date.from(LocalDateTime.now().minusDays(2).atZone(ZoneId.systemDefault()).toInstant());
    user.setCreated(hour);
    sps.setString("HOURS(created) == 48");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "HOURS(now - 2d)==48");

    hour = Date.from(LocalDateTime.now().minusDays(2).plusMinutes(30).atZone(ZoneId.systemDefault()).toInstant());
    user.setCreated(hour);
    sps.setString("HOURS(created) == 47");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "HOURS(now - 2d + 30m)==47");

    var minute = Date.from(LocalDateTime.now().minusHours(2).atZone(ZoneId.systemDefault()).toInstant());
    user.setCreated(minute);
    sps.setString("MINUTES(created) == 120");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "MINUTES(now - 2h)==120");

    minute = Date.from(LocalDateTime.now().minusHours(2).plusSeconds(30).atZone(ZoneId.systemDefault()).toInstant());
    user.setCreated(minute);
    sps.setString("MINUTES(created) == 119");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "MINUTES(now - 2h + 30s)==119");

    sps.setString("emailVerified==false");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "emailVerified==false");

    user.setEmailVerified(true);
    sps.setString("emailVerified==true");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "emailVerified==true");

    user.setId(666);
    sps.setString("id==666");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "id==666");

    sps.setString("address.regionId==\\"CA-ON\\"");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "address.regionId==\\"CA-ON\\"");

    sps.setString("address.regionId!=\\"wonderland\\"");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "address.regionId!=\\"wonderland\\"");

    sps.setString("address.regionId.len==5");
    test(((Predicate) parser.parse(sps, px).value()).f(user), "address.regionId.len==5");

    sps.setString("if(id exists){id}else{0}");
    test(((Number)((Expr)parser.parse(sps, px).value()).f(user)).longValue()==666, "if(id exists){id}else{0} -> 666");

    sps.setString("if(id exists && id==666){id}else{0}");
    test(((Number)((Expr)parser.parse(sps, px).value()).f(user)).longValue()==666, "if(id exists && id==666){id}else{0} -> 666");

    sps.setString("if(unknown==null){999}else{0}");
    test(parser.parse(sps, px) == null, "if(unknown==null){999}else{0} --> null");

    sps.setString("if(unknown!=null){999}else{0}");
    test(parser.parse(sps, px) == null, "if(unknown!=null){999}else{0} --> null");

    sps.setString("if(unknown!=null && unknown==999){999}else{0}");
    test(parser.parse(sps, px) == null, "if(unknown!=null && unknown==999){999}else{0} --> null");

    sps.setString("if(unknown==999){999}else{0}");
    test(parser.parse(sps, px) == null, "if(unknown==999){999}else{0} --> null");

    sps.setString("if(unknown !exists){999}else{0}");
    test(parser.parse(sps, px) == null, "if(unknown !exists){999}else{0} -> null");
    // sps.setString("if(unknown !exists){999}else{0}");
    // test(Double.valueOf(((Expr) parser.parse(sps, px).value()).f(user).toString())==999, "if(unknown !exists){999}else{0} -> 999");

    sps.setString("if(unknown exists){999}else{0}");
    test(parser.parse(sps, px) == null, "if(unknown exists){999}else{0} -> null");
    // sps.setString("if(unknown exists){999}else{0}");
    // test(Double.valueOf(((Expr) parser.parse(sps, px).value()).f(user).toString())==0, "if(exists unknown){999}else{0} -> 0");

    Object result = null;
    sps.setString("if(address.regionId.len==5){firstName}else{lastName.len+3}");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test("marmelad".equals(result.toString()), "if(address.regionId.len==5){firstName}else{lastName.len==3}");

    sps.setString("if ( address.regionId.len==4 ) { firstName } else { lastName.len+3 }");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test((((Number) result)).doubleValue() == 8, "if ( address.regionId.len==5 ) { firstName } else { lastName.len==3 }");

    sps.setString("if ( address.regionId.len==4 ) { firstName } else { if ( lastName.len+3==10 ) { address.regionId } else { address.city } }");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test("Toronto".equals(result.toString()), "if ( address.regionId.len==4 ) { firstName } else { if ( lastName.len+3==10 ) { address.regionId } else { address.city } }"+result.toString()+" class "+result.getClass().getName());

    sps.setString("address instanceof foam.core.auth.Address");
    test(( ((Predicate) parser.parse(sps, px).value()).f(user)), "address instanceof foam.core.auth.Address");

    sps.setString("!(address instanceof foam.core.auth.User)");
    test(( ((Predicate) parser.parse(sps, px).value()).f(user)), "!(address instanceof foam.core.auth.User)");

    sps.setString("address instanceof foam.core.auth.Address");
    test(( ((Predicate) parser.parse(sps, px).value()).f(user)), "address instanceof foam.core.auth.Address");

    sps.setString("address classof foam.core.auth.Address");
    test(( ((Predicate) parser.parse(sps, px).value()).f(user)), "address classOf foam.core.auth.Address");

    sps.setString("address classof foam.core.auth.PKAddress");
    test(! ( ((Predicate) parser.parse(sps, px).value()).f(user)), "! address classOf foam.core.auth.PKAddress");

    user.setAddress(new foam.core.auth.PKAddress.Builder(x).build());
    sps.setString("address classof foam.core.auth.PKAddress");
    test(( ((Predicate) parser.parse(sps, px).value()).f(user)), "address classOf foam.core.auth.PKAddress");

    sps.setString("address classof foam.core.auth.Address");
    test( ! ( ((Predicate) parser.parse(sps, px).value()).f(user)), "! address classOf foam.core.auth.Address");

    user.setAddress(addr);

    sps.setString("SYSTEM_USER_ID==1");
    test(( ((Predicate) parser.parse(sps, px).value()).f(user)), "SYSTEM_USER_ID==1");
    sps.setString("let testVar = 4+7; address.regionId.len<testVar");
    test(( ((Predicate) parser.parse(sps, px).value()).f(user)), "let testVar = 4+7; address.regionId.len<testVar");

    sps.setString("let testVar11 = 4+7; if ( testVar > 8 ) { if (testVar11 < 0 ) { 0 } else { testVar11 } } else { 0 }");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test((((Number) result)).doubleValue() == 11, "let testVar11 = 4+7; if ( testVar11 > 8 ) { testVar } else { 0 }");

    sps.setString("let newVar = address.regionId.len; address.regionId.len==newVar");
    test(( ((Predicate) parser.parse(sps, px).value()).f(user)), "let testVar2 = address.regionId.len; address.regionId.len==testVar");


    var sprtCnfg = new foam.core.app.SupportConfig();
    var theme = new foam.core.theme.Theme();
    sprtCnfg.setSupportAddress(addr);
    theme.setSupportConfig(sprtCnfg);
    parser = FScriptParser.create(foam.core.theme.Theme.SUPPORT_CONFIG);

    sps.setString("supportConfig.supportAddress.regionId!=supportConfig.supportAddress.countryId");
    test(((Predicate) parser.parse(sps, px).value()).f(theme), "supportConfig.supportAddress.regionId!=supportConfig.supportAddress.countryId");
    test(((Predicate) parser.parse(sps, px).value()).f(theme), "supportConfig.supportAddress.regionId!=supportConfig.supportAddress.countryId");
    sps.setString("supportConfig.supportAddress.regionId==\\"CA-ON\\"");
    test(((Predicate) parser.parse(sps, px).value()).f(theme), "supportConfig.supportAddress.regionId==\\"CA-ON\\"");
    sps.setString("supportConfig.supportAddress instanceof foam.core.auth.Address");
    test(((Predicate) parser.parse(sps, px).value()).f(theme), "supportConfig.supportAddress instanceof oam.core.auth.Address");

    var rule = new Rule();
    parser = FScriptParser.create(foam.core.ruler.Rule.OPERATION);
    rule.setOperation(foam.core.dao.Operation.CREATE);
    sps.setString("thisValue==foam.core.dao.Operation.CREATE");
    test(((Predicate) parser.parse(sps, px).value()).f(rule), "thisValue==foam.core.dao.Operation.CREATE");
    sps.setString("instanceof foam.core.ruler.Rule");
    test(((Predicate) parser.parse(sps, px).value()).f(rule), "thisValue instanceof foam.core.ruler.Rule");

    List<LiteralIC> expressions = new ArrayList();
    expressions.add(new LiteralIC("lit_int_10", new Constant(10)));
    expressions.add(new LiteralIC("lit_int_20", new Constant(20)));
    expressions.add(new LiteralIC("lit_int_30", new Constant(30)));
    expressions.add(new LiteralIC("lit_float_111", new Constant(111.0)));
    expressions.add(new LiteralIC("lit_float_222", new Constant(222.0)));
    expressions.add(new LiteralIC("lit_float_333", new Constant(333.0)));
    expressions.add(new LiteralIC("region", new Constant("CA-ON")));
    parser = FScriptParser.create(foam.parse.test.FScriptParserTestUser.getOwnClassInfo(), expressions);

    sps.setString("if (address.regionId==region) {firstName} else {null}");
    result = (String) ((Expr)parser.parse(sps, px).value()).f(user);
    test("marmelad".equals(result), "if (address.regionId==region) {firstName} else {null}");

    sps.setString("lit_int_10 * lit_int_20");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test((((Number) result)).doubleValue() == 200, "expect: 10 * 20 == 200, found: "+result);

    sps.setString("(lit_int_10 * lit_int_20)-(lit_float_111*lit_int_10)");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test((((Number) result)).doubleValue() == -910.0, "expect: (10*20)-(111.0*10) == -910.0, found: "+result);

    sps.setString("lit_int_30+lit_int_20-lit_int_10");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test((((Number) result)).doubleValue() == 40, "expect: 30+20-10 == 40, found: "+result);

    sps.setString("Hello, {{firstName}}. Is {{lastName}} your last name?");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test(((String) result).equals("Hello, "+user.getFirstName()+". Is "+user.getLastName()+" your last name?"), "Hello, {{firstName}}. Is {{lastName}} your last name?");

    sps.setString("Hello, {{firstName}}");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test(((String) result).equals("Hello, "+user.getFirstName()+""), "Hello, {{firstName}}");

    sps.setString("(lit_int_10 * lit_int_20)-(lit_float_111*lit_int_10)+(lit_int_30+(lit_int_20-lit_int_10))");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test((((Number) result)).doubleValue() == -870.0, "expect: (10*20)-(111.0*10)+(30+(20-10)) == -870.0, found: "+result);

    sps.setString("((lit_int_10 * lit_int_20)-(lit_float_111*lit_int_10))-(lit_int_30+(lit_int_20-lit_int_10))");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test((((Number) result)).doubleValue() == -950.0, "expect: ((10*20)-(111.0*10))-(30+(20-10)) == -950.0, found: "+result);

    sps.setString("if(lit_int_20 > lit_int_10){lit_int_30}else{0}");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test((((Number) result)).doubleValue() == 30, "expect: if(lit_int_20 > lit_int_10){lit_int_30}else{0} == 30, found: "+result);

    sps.setString("if(lit_int_20 > lit_int_10){lit_int_30*10}else{0}");
    result = ((Expr) parser.parse(sps, px).value()).f(user);
    test((((Number) result)).doubleValue() == 300, "expect: if(lit_int_20 > lit_int_10){lit_int_30*10}else{0} == 300, found: "+result);

    user.setTestint1(11);
    user.setTestint2(22);
    user.setTestint3(33);
    sps.setString("MAX(0, (testint1 * testint2) - testint3) == (testint1 * testint2) - testint3");
    result = ((Predicate) parser.parse(sps, px).value()).f(user);
    test(((Boolean) result), "expect: MAX(0, (testint1 * testint2) - testint3) == (testint1 * testint2) - testint3 -> true, found: "+result);

    // MAX rounds, so these will never be equal.
    // sps.setString("(Employee_Earnings_CA + Employee_Reimbursement_CA) - (Employee_Tax_CA_Federal + Employee_Tax_Non_Periodic_CA_Federal + Employee_Tax_CA_Provincial + Employee_Tax_Non_Periodic_CA_Provincial + Employee_EI_Contribution_CA + Employee_CPP_Contribution_CA + Employee_Deductions_CA) == MAX(0, (Employee_Earnings_CA + Employee_Reimbursement_CA) - (Employee_Tax_CA_Federal + Employee_Tax_Non_Periodic_CA_Federal + Employee_Tax_CA_Provincial + Employee_Tax_Non_Periodic_CA_Provincial + Employee_EI_Contribution_CA + Employee_CPP_Contribution_CA + Employee_Deductions_CA))");
    // result = ((Predicate) parser.parse(sps, px).value()).f(user);
    // test(((Boolean) result), "expect: equation == MAX(0, equation) -> true, found: "+result);

     sps.setString("if(lit_int_20 > lit_int_10){(Employee_Earnings_CA + Employee_Reimbursement_CA)}else{0} - (Employee_Tax_CA_Federal + Employee_Tax_Non_Periodic_CA_Federal + Employee_Tax_CA_Provincial + Employee_Tax_Non_Periodic_CA_Provincial + Employee_EI_Contribution_CA + Employee_CPP_Contribution_CA + Employee_Deductions_CA) == (Employee_Earnings_CA + Employee_Reimbursement_CA) - (Employee_Tax_CA_Federal + Employee_Tax_Non_Periodic_CA_Federal + Employee_Tax_CA_Provincial + Employee_Tax_Non_Periodic_CA_Provincial + Employee_EI_Contribution_CA + Employee_CPP_Contribution_CA + Employee_Deductions_CA)");
    result = ((Predicate) parser.parse(sps, px).value()).f(user);
    test(((Boolean) result), "expect: if(lit_int_20 > lit_int_10){equation = equation}else{false} -> true , found: "+result);

     sps.setString("0 / 1");
     result = ((Expr) parser.parse(sps, px).value()).f(user);
     test ((((Number) result)).doubleValue() == 0, "expect: 0 / 1 -> 0, found: "+result);

     sps.setString("1 / 0");
     try {
       result = ((Expr) parser.parse(sps, px).value()).f(user);
       test (false, "expect: 1 / 0 -> exception, found: "+result);
     } catch (RuntimeException e) {
       test (true, "expect: 1 / 0 -> exception, found: "+e.getMessage());
     }
     `
    }
  ]
});
