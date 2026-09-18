/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.dig.test',
  name: 'DigCsvDriverTest',
  extends: 'foam.core.test.Test',

  documentation: `The dig CSV response must open correctly in Excel: UTF-8
    bytes behind a charset the servlet writer picks up, a leading byte order
    mark, and ISO 8601 24h dates. The response stub fixes the writer's charset
    at creation from the content type set so far, as a servlet container does.`,

  javaImports: [
    'foam.lang.X',
    'foam.lang.XFactory',
    'foam.core.alarming.Alarm',
    'foam.core.dig.drivers.DigCsvDriver',
    'foam.dao.MDAO',
    'jakarta.servlet.http.HttpServletResponse',
    'java.io.ByteArrayOutputStream',
    'java.io.OutputStreamWriter',
    'java.io.PrintWriter',
    'java.lang.reflect.Proxy',
    'java.nio.charset.StandardCharsets',
    'java.text.SimpleDateFormat',
    'java.util.Date',
    'java.util.List'
  ],

  methods: [
    {
      name: 'runTest',
      args: 'X x',
      javaCode: `
      final ByteArrayOutputStream bytes       = new ByteArrayOutputStream();
      final String[]              contentType = new String[1];
      final PrintWriter[]         writer      = new PrintWriter[1];

      final HttpServletResponse resp = (HttpServletResponse) Proxy.newProxyInstance(
        HttpServletResponse.class.getClassLoader(),
        new Class[] { HttpServletResponse.class },
        (proxy, method, args) -> {
          switch ( method.getName() ) {
            case "setContentType": contentType[0] = (String) args[0]; return null;
            case "getContentType": return contentType[0];
            case "getWriter":
              if ( writer[0] == null ) {
                String cs = contentType[0] != null && contentType[0].toLowerCase().contains("charset=utf-8") ? "UTF-8" : "ISO-8859-1";
                writer[0] = new PrintWriter(new OutputStreamWriter(bytes, cs), true);
              }
              return writer[0];
          }
          Class rt = method.getReturnType();
          if ( rt == boolean.class ) return false;
          if ( rt.isPrimitive() )    return 0;
          return null;
        });

      X y = x
        .put(HttpServletResponse.class, resp)
        .putFactory(PrintWriter.class, new XFactory() {
          public Object create(X ctx) {
            try { return resp.getWriter(); } catch (java.io.IOException e) { return null; }
          }
        });

      Date  created = new Date(1788307145000L); // 2026-09-02T04:59:05Z
      Alarm alarm   = new Alarm();
      alarm.setName("CIH Émetteur — «test»");
      alarm.setCreated(created);

      new DigCsvDriver.Builder(y).build()
        .outputFObjects(y, new MDAO(Alarm.getOwnClassInfo()), List.of(alarm), new String[] { "name", "created" });

      byte[] out = bytes.toByteArray();
      test(out.length > 3 && (out[0] & 0xFF) == 0xEF && (out[1] & 0xFF) == 0xBB && (out[2] & 0xFF) == 0xBF,
        "response starts with the UTF-8 byte order mark");
      test("text/csv;charset=utf-8".equals(contentType[0]),
        "content type carries charset=utf-8: " + contentType[0]);

      String csv = new String(out, StandardCharsets.UTF_8);
      test(csv.contains("CIH Émetteur — «test»"),
        "non-ASCII text is written as UTF-8 bytes (content type set before the writer was created): " + csv);

      String iso = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(created);
      test(csv.contains(iso),
        "DateTime is written as ISO 8601 24h, not Date.toString(): expected " + iso + " in " + csv);
      test(! csv.contains("EDT 2026") && ! csv.contains("UTC 2026") && ! csv.contains(" AM") && ! csv.contains(" PM"),
        "no Date.toString() or 12h output: " + csv);
      `
    }
  ]
});
