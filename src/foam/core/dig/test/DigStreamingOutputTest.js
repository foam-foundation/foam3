/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.dig.test',
  name: 'DigStreamingOutputTest',
  extends: 'foam.core.test.Test',

  documentation: `A dig select of millions of rows fails when a driver builds the
    whole response as one string before writing it: the string outgrows the
    heap or the largest array Java can allocate, and the browser gets a broken
    download. Each driver must write a row to the response before it reads the
    next one. The row list here records how much of the response was already
    written each time the driver asks for a row; that number has to grow from
    row to row.`,

  javaImports: [
    'foam.core.alarming.Alarm',
    'foam.core.dig.drivers.*',
    'foam.dao.MDAO',
    'foam.lang.X',
    'foam.lang.XFactory',
    'jakarta.servlet.http.HttpServletResponse',
    'java.io.PrintWriter',
    'java.io.StringWriter',
    'java.lang.reflect.Proxy',
    'java.util.AbstractList',
    'java.util.Date'
  ],

  methods: [
    {
      name: 'runTest',
      args: 'X x',
      javaCode: `
      DigFormatDriver[] drivers = new DigFormatDriver[] {
        new DigCsvDriver.Builder(x).build(),
        new DigCsvSheetsDriver.Builder(x).build(),
        new DigJsonDriver.Builder(x).build(),
        new DigJsonJDriver.Builder(x).build(),
        new DigXmlDriver.Builder(x).build()
      };

      for ( DigFormatDriver driver : drivers ) {
        String        name    = driver.getClass().getSimpleName();
        StringWriter  body    = new StringWriter();
        final int[]   written = new int[3];
        final Alarm[] alarms  = createAlarms();

        AbstractList rows = new AbstractList() {
          public int size() { return alarms.length; }
          public Object get(int i) {
            written[i] = body.getBuffer().length();
            return alarms[i];
          }
        };

        X y = withResponse(x, body);
        driver.outputFObjects(y, new MDAO(Alarm.getOwnClassInfo()), rows, null);

        test(written[1] > written[0] && written[2] > written[1],
          name + " writes each row before reading the next: response length when rows 1, 2, 3 were read = "
            + written[0] + ", " + written[1] + ", " + written[2]);
        test(body.toString().contains("dig-stream-2"),
          name + " writes the last row");
      }
      `
    },
    {
      name: 'createAlarms',
      javaType: 'Alarm[]',
      javaCode: `
      Alarm[] alarms = new Alarm[3];
      for ( int i = 0 ; i < alarms.length ; i++ ) {
        alarms[i] = new Alarm();
        alarms[i].setName("dig-stream-" + i);
        alarms[i].setCreated(new Date(1788307145000L + i));
      }
      return alarms;
      `
    },
    {
      name: 'withResponse',
      type: 'X',
      documentation: `A context whose response writer appends straight to
        body, with no buffer in between, so body shows what the driver has
        written so far.`,
      args: 'X x, StringWriter body',
      javaCode: `
      final PrintWriter writer = new PrintWriter(body);
      final HttpServletResponse resp = (HttpServletResponse) Proxy.newProxyInstance(
        HttpServletResponse.class.getClassLoader(),
        new Class[] { HttpServletResponse.class },
        (proxy, method, args) -> {
          if ( "getWriter".equals(method.getName()) ) return writer;
          Class rt = method.getReturnType();
          if ( rt == boolean.class ) return false;
          if ( rt.isPrimitive() )    return 0;
          return null;
        });

      return x
        .put(HttpServletResponse.class, resp)
        .putFactory(PrintWriter.class, new XFactory() {
          public Object create(X ctx) { return writer; }
        });
      `
    }
  ]
});
