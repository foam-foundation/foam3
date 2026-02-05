/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.dig.drivers',
  name: 'DigCsvDriver',
  extends: 'foam.core.dig.drivers.DigFormatDriver',
  flags: ['java'],

  javaImports: [
    'foam.lang.*',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.lib.csv.CSVOutputter',
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
      value: 'CSV'
    }
  ],

  methods: [
    {
      name: 'parseFObjects',
      javaCode: `
      ArraySink arraySink = new ArraySink();
      InputStream is = new ByteArrayInputStream(data.toString().getBytes());

      ClassInfo cInfo = dao.getOf();
      CSVSupport csvSupport = new CSVSupport();
      csvSupport.setX(x);
      csvSupport.inputCSV(is, arraySink, cInfo);

      List list = arraySink.getArray();

      if ( list == null || list.size() == 0 ) {
        DigUtil.outputException(x, new ParsingErrorException("Invalid CSV Format"), getFormat());
        return null;
      }

      return list;
      `
    },
    {
      name: 'outputFObjects',
      javaCode: `
      HttpServletResponse resp   = x.get(HttpServletResponse.class);
      PrintWriter         out    = x.get(PrintWriter.class);
      ClassInfo           cInfo  = dao.getOf();
      String              output = null;

      if ( fobjects == null || fobjects.size() == 0 ) {
        out.println("[]");
        return;
      }

      CSVOutputterImpl csv = new CSVOutputterImpl.Builder(x)
        .setOf(cInfo)
        .build();

      if ( cols != null && cols.length > 0 ) csv.setProps(cols);

      for ( Object o : fobjects ) {
        FObject fobj = (FObject) o;
        csv.outputFObject(x, fobj);
        out.append(csv.getSb());
        csv.getSb().setLength(0); // stream: clear buffer after each row
      }

      out.println();
      out.flush();
      `
    }
  ]
});
