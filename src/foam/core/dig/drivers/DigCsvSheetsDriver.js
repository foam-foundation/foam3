/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.dig.drivers',
  name: 'DigCsvSheetsDriver',
  extends: 'foam.core.dig.drivers.DigCsvDriver',
  flags: ['java'],

  javaImports: [
    'foam.lang.*',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lib.csv.CSVOutputterImpl',
    'foam.lib.csv.CSVSupport',
    'foam.lib.json.OutputterMode',
    'foam.core.boot.CSpec',
    'foam.core.dig.*',
    'foam.core.dig.exception.*',
    'foam.core.http.*',
    'foam.core.logger.Logger',
    'foam.core.logger.PrefixLogger',
    'foam.util.SafetyUtil',
    'java.io.ByteArrayInputStream',
    'java.io.InputStream',
    'java.io.PrintWriter',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List',
    'jakarta.servlet.http.HttpServletResponse'
  ],

  properties: [
    {
      name: 'format',
      value: 'CSV/Sheets'
    }
  ],

  methods: [
    {
      name: 'outputFObjects',
      javaCode: `
      HttpServletResponse resp = x.get(HttpServletResponse.class);
      PrintWriter out = x.get(PrintWriter.class);
      ClassInfo cInfo = dao.getOf();
      String output = null;

      if ( fobjects == null || fobjects.size() == 0 ) {
        out.println("[]");
        return;
      }

      CSVOutputterImpl outputterCsv = new CSVOutputterImpl.Builder(x)
        .setSheetsCompatible(true)
        .setOf(cInfo)
        .build();

      // Write each row to the response and empty the buffer, so a large
      // download never sits in memory as one string.
      for ( Object o : fobjects ) {
        outputterCsv.outputFObject(x, (FObject) o);
        out.append(outputterCsv.getSb());
        outputterCsv.getSb().setLength(0);
      }

      out.println();
      `
    }
  ]
});
