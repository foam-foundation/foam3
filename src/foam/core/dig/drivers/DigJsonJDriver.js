/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.dig.drivers',
  name: 'DigJsonJDriver',
  extends: 'foam.core.dig.drivers.DigJsonDriver',
  flags: [ 'java' ],

  javaImports: [
    'foam.lang.*',
    'foam.dao.DAO',
    'foam.lib.csv.CSVOutputter',
    'foam.lib.json.OutputterMode',
    'foam.core.boot.CSpec',
    'foam.core.dig.*',
    'foam.core.dig.exception.*',
    'foam.core.http.*',
    'foam.core.logger.Logger',
    'foam.core.logger.PrefixLogger',
    'foam.util.SafetyUtil',
    'java.io.PrintWriter',
    'java.util.List',
    'jakarta.servlet.http.HttpServletResponse'
  ],

  properties: [
    {
      name: 'format',
      value: 'JSONJ'
    }
  ],

  methods: [
    {
      name: 'parseFObjects',
      javaCode: `
      String dataJson    = "[";
      String dataJsonJ[] = data.split("\\r?\\n");

      for ( String i:dataJsonJ ) {
        i = i.trim();
        if ( i.startsWith("p(") ) {
          dataJson += i.substring(2, i.length()-1) + ',';
        }
      }
      dataJson += "]";

      return super.parseFObjects(x, dao, dataJson);
      `
    },
    {
      name: 'outputFObjects',
      javaCode: `
      PrintWriter out    = x.get(PrintWriter.class);
      String      output = null;

      if ( fobjects == null || fobjects.size() == 0 ) {
        out.println("[]");
        return;
      }

      foam.lib.PropertyPredicate predicate = new foam.lib.AndPropertyPredicate(x,
        new foam.lib.PropertyPredicate[] {
          new foam.lib.ExternalPropertyPredicate(),
          new foam.lib.NetworkPropertyPredicate(),
          new foam.lib.PermissionedPropertyPredicate()});

      if ( cols != null && cols.length > 0 ) {
        predicate = new foam.lib.AndPropertyPredicate(x,
          new foam.lib.PropertyPredicate[] {
            predicate,
            new foam.lib.PropertyPredicate() {
              public boolean propertyPredicateCheck(X x, String of, PropertyInfo prop) {
                for ( int i = 0 ; i < cols.length ; i++ ) {
                  if ( prop.getName().equals(cols[i]) ) return true;
                }
                return false;
              }
            }
          });
      }

      // Write each row straight to the response. Building the whole file as
      // one string first fails on a large DAO: 15 million rows are more text
      // than one Java string can hold.
      foam.lib.json.Outputter outputterJsonJ = new foam.lib.json.Outputter(x, out)
        .setPropertyPredicate(predicate);

      HttpParameters p = x.get(HttpParameters.class);
      if ( p != null && "false".equals(p.getParameter("multiline")) ) {
        outputterJsonJ.setMultiLine(false);
      } else {
        outputterJsonJ.setMultiLine(true);
      }

      for ( Object obj : fobjects ) {
        outputterJsonJ.outputJSONJFObject((FObject) obj);
      }

      out.println();
      `
    }
  ]
});
