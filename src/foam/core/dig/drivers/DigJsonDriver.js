/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.dig.drivers',
  name: 'DigJsonDriver',
  extends: 'foam.core.dig.drivers.DigFormatDriver',

  flags: [ 'java' ],

  javaImports: [
    'foam.lang.*',
    'foam.dao.DAO',
    'foam.lib.PropertyPredicate',
    'foam.lib.json.JSONParser',
    'foam.lib.json.MapParser',
    'foam.lib.formatter.FObjectFormatter',
    'foam.lib.formatter.JSONFObjectFormatter',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.StringPStream',
    'foam.lib.parse.PStream',
    'foam.core.dig.*',
    'foam.core.dig.exception.*',
    'foam.core.http.*',
    'foam.util.SafetyUtil',
    'java.io.PrintWriter',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List',
    'java.util.Map',
    'java.util.Set'
  ],

  properties: [
    {
      name: 'format',
      value: 'JSON'
    }
  ],

  methods: [
    {
      name: 'parseFObjects',
      javaCode: `
      JSONParser jsonParser = new JSONParser();
      jsonParser.setX(x);

      var p = x.get(HttpParameters.class);
      if ( p.getParameter("nameMapping") != null ) {
        var ret = parseMap(p.getParameter("nameMapping"));
        if ( ret.value() != null && ((Map)ret.value()).size() != 0 ) {
          data = new FieldNameMapGrammar().replaceFields(data, (Map) ret.value());
        }
      }

      // Attempt to parse array
      ClassInfo cInfo = dao.getOf();
      Object o = jsonParser.parseStringForArray(data, cInfo.getObjClass());

      // Attempt to parse single object
      if ( o == null )
        o = jsonParser.parseString(data, cInfo.getObjClass());

      if ( o == null ) {
        DigUtil.outputException(x, new ParsingErrorException("Invalid JSON Format"), getFormat());
        return null;
      }

      List list = null;
      if ( o instanceof Object[] ) {
        Object[] objs = (Object[]) o;
        list = Arrays.asList(objs);
      } else {
        list = new ArrayList();
        list.add(o);
      }

      if ( p.getParameter("fieldValue") != null ) {
        var ret = parseMap(p.getParameter("fieldValue"));
        if ( ret != null && ((Map)ret.value()).size() != 0 ) {
          Map map  = (Map) ret.value();
          Set keys = map.entrySet();
          for ( Object ob : list ) {
            if ( ob instanceof FObject ) {
              FObject f = (FObject) ob;
              map.forEach((k,v) -> {
                PropertyInfo prop = (PropertyInfo) f.getClassInfo().getAxiomByName((String)k);
                if ( prop != null ) {
                  prop.set(f, map.get(k));
                }
              });
            }
          }
        }
      }

      return o instanceof FObject ? o : list;
      `
    },
    {
      name: 'outputFObjects',
      javaCode: `
        PrintWriter out = x.get(PrintWriter.class);

        if ( fobjects == null || fobjects.size() == 0 ) {
          out.println("[]");
          return;
        }

        var formatter = createFormatter(x, cols);

        out.println("[");

        boolean first = true;
        for ( Object o : fobjects ) {
          if ( ! first ) out.println(',');
          formatter.output(o);
          out.print(formatter.builder().toString());
          formatter.reset();
          first = false;
        }

        out.println("]");
      `
    },
    {
      name: 'outputFObject',
      javaCode: `
      PrintWriter out = x.get(PrintWriter.class);

      if ( obj == null ) return;

      var formatter = createFormatter(x, cols);
      formatter.output(obj);

      // Output the formatted data
      out.println(formatter.builder().toString());
      `
    },
    {
      name: 'parseMap',
      args: 'String data',
      type: 'PStream',
      javaCode: `
      StringPStream mapStr = new StringPStream();
      mapStr.setString(data);
      var mapParser = MapParser.instance();
      var ret = mapParser.parse(mapStr, new ParserContextImpl());
      return ret;
      `
    },
    {
      name: 'createFormatter',
      type: 'FObjectFormatter',
      args: 'Context x, String[] cols',
      javaCode: `
        var formatter = new JSONFObjectFormatter();
        formatter.setQuoteKeys(true);
        formatter.setOutputClassNames(true);
        formatter.setOutputDefaultValues(true);
        formatter.setMultiLine(true);
        formatter.setPropertyPredicate(new foam.lib.AndPropertyPredicate(
           new PropertyPredicate[] {
             new foam.lib.NetworkPropertyPredicate(), // Added to prevent fields like User.password from being sent
             new foam.lib.ExternalPropertyPredicate(),
             new foam.lib.PermissionedPropertyPredicate() }));
        formatter.setX(x);

        if ( cols != null && cols.length > 0 ) {
          formatter.setPropertyPredicate(new foam.lib.AndPropertyPredicate(
           new PropertyPredicate[] {
             formatter.getPropertyPredicate(),
             new PropertyPredicate() {
               public boolean propertyPredicateCheck(X x, String of, PropertyInfo prop) {
                 // Doesn't need to be efficient because it is cached
                 for ( int i = 0 ; i < cols.length ; i++ ) {
                   if ( prop.getName().equals(cols[i]) ) return true;
                 }
                 return false;
               }
             }
          }));
        }

        var p = x.get(HttpParameters.class);
        if ( p != null ) {
          var multiline = (String) p.getParameter("multiline");
          if ( ! SafetyUtil.isEmpty(multiline) ) formatter.setMultiLine(isEnabled(multiline));
        }

        return formatter;
      `
    },
    {
      name: 'isEnabled',
      type: 'boolean',
      args: 'String value',
      javaCode: `
        value = value.trim().toLowerCase();
        return "true".equals(value) || "t".equals(value) || "1".equals(value) || "yes".equals(value) || "y".equals(value) || "on".equals(value);
      `
    }
  ]
});
