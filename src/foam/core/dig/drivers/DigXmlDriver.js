/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.dig.drivers',
  name: 'DigXmlDriver',
  extends: 'foam.core.dig.drivers.DigFormatDriver',
  flags: ['java'],

  javaImports: [
    'foam.core.boot.CSpec',
    'foam.core.dig.*',
    'foam.core.dig.exception.*',
    'foam.core.http.*',
    'foam.core.logger.Logger',
    'foam.core.logger.PrefixLogger',
    'foam.dao.DAO',
    'foam.lang.*',
    'foam.lib.PropertyPredicate',
    'foam.lib.csv.CSVOutputter',
    'foam.lib.json.OutputterMode',
    'foam.util.SafetyUtil',
    'jakarta.servlet.http.HttpServletResponse',
    'java.io.PrintWriter',
    'java.io.StringReader',
    'java.util.List',
    'javax.xml.stream.XMLInputFactory',
    'javax.xml.stream.XMLStreamReader'
  ],

  properties: [
    {
      name: 'format',
      value: 'XML'
    }
  ],

  methods: [
    {
      name: 'parseFObjects',
      javaCode: `
      StringReader reader = new StringReader(data);
      XMLSupport xmlSupport = new XMLSupport();

      XMLInputFactory factory = XMLInputFactory.newInstance();
      factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);

      ClassInfo cInfo = dao.getOf();
      List<FObject> objList = xmlSupport.fromXML(x, factory.createXMLStreamReader(reader), cInfo.getObjClass());

      if ( objList.size() == 0 ) {
        DigUtil.outputException(x, new ParsingErrorException("Invalid XML Format"), getFormat());
        return null;
      }

      return objList;
      `
    },
    {
      name: 'outputFObjects',
      javaCode: `
      HttpServletResponse resp  = x.get(HttpServletResponse.class);
      PrintWriter         out   = x.get(PrintWriter.class);
      ClassInfo           cInfo = dao.getOf();

      if ( fobjects == null || fobjects.size() == 0 ) {
        resp.setContentType("text/html");
        out.println("[]");
        return;
      }

      resp.setContentType("application/xml");

      foam.lib.xml.Outputter outputterXml = new foam.lib.xml.Outputter(x, out, OutputterMode.NETWORK);

      if ( cols != null && cols.length > 0 ) {
        outputterXml.setPropertyPredicate(new PropertyPredicate() {
          public boolean propertyPredicateCheck(X x, String of, PropertyInfo prop) {
            // Doesn't need to be efficient because it is cached
            for ( int i = 0 ; i < cols.length ; i++ ) {
              if ( prop.getName().equals(cols[i]) ) return true;
            }
            return false;
          }
        });
      }


      String simpleName = cInfo.getSimpleName();

      // String header  = "<?xml version=\\"1.0\\" encoding=\\"ISO-8859-1\\"?>;

      out.println("<" + simpleName + "s>");
      for ( Object o : fobjects ) {
        outputterXml.output(o);
      }
      out.println("</" + simpleName + "s>");
      `
    }
  ]
});
