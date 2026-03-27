/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.lang',
  name: 'Indexer',

  javaExtends: [ 'foam.mlang.F' ],

  methods: [
    'int comparePropertyToValue(Object key, Object value)'
  ]
});


foam.INTERFACE({
  package: 'foam.lang',
  name: 'PropertyInfo',

  javaImports: [
    'foam.crypto.hash.Hasher',
    'foam.crypto.sign.Signer',
    'foam.dao.jdbc.IndexedPreparedStatement',
    'foam.dao.SQLStatement',
    'foam.lib.parse.Parser',
    'foam.mlang.Expr',
    'foam.mlang.order.Comparator',
    'java.util.Map',
    'javax.xml.stream.XMLStreamReader'
  ],

  javaExtends: [
    'Axiom',
    'ClassInfoAware',
    'Comparable',
    'Comparator',
    'Expr',
    'Hasher',
    'Indexer',
    'Signer',
    'SQLStatement'
  ],

  // TODO: break into XML, CSV, SQL, Sheets, PII, crypto
  methods: [
    'boolean getExternalTransient() { return false; }',
    'boolean getNetworkTransient() { return false; }',
    'boolean getReadPermissionRequired() { return false; }',
    'boolean getWritePermissionRequired() { return false; }',
    'boolean getUpdatePermissionRequired() { return false; }',
    'boolean getStorageTransient() { return false; }',
    'boolean getStorageOptional() { return false; }',
    'boolean getClusterTransient() { return false; }',
    'boolean getXMLAttribute() { return false; }',
    'boolean getXMLTextNode() { return false; }',
    'boolean getRequired() { return false; }',
    'java.lang.Class getValueClass()',
    'String getName()',
    'String[] getAliases()',
    'String getShortName() { return null; }',
    'byte[] getNameAsByteArray()',
    'Object get(Object obj)',
    'void set(Object obj, Object value)',
    'void clear(Object obj)',
    'Parser jsonParser()', // Specify parser to use for Java JSON parsing. Set javaJSONParser: 'null' (String literal) to remove parsing support.
    'Parser queryParser()',
    'Parser csvParser()',
    'void toJSON(foam.lib.json.Outputter outputter, Object value) { outputter.output(value); }',
    'void format(foam.lib.formatter.FObjectFormatter outputter, FObject obj)',
    'void formatJSON(foam.lib.formatter.FObjectFormatter formatter, FObject obj) { format(formatter, obj); }',
    'void toCSV(X x, Object obj, foam.lib.csv.CSVOutputter outputter) { outputter.outputValue(obj != null ? get(obj) : null); }',
    'void toCSVLabel(X x, foam.lib.csv.CSVOutputter outputter) { outputter.outputValue(getName()); }',
    'void toXML(foam.lib.xml.Outputter outputter, Object value) { outputter.output(value); }',
    `void diff(FObject o1, FObject o2, Map diff, PropertyInfo prop) {
      if ( prop.compare(o1, o2) != 0 ) {
        diff.put(prop.getName(), prop.f(o2));
      }
    }`,
    {
      signature: 'boolean hardDiff(FObject o1, FObject o2, FObject diff)',
      documentation: `
        return true if there are difference, then the property value from o2 will set to diff
        return false if there is no differnce, then null will be set to diff
      `,
      javaCode: `
        // compare the property value of o1 and o2
        // If value is Object reference, only compare reference. (AbstractObjectPropertyInfo will override hardDiff method)
        // use to compare String and primitive type
        int same = comparePropertyToValue(this.get(o1), this.get(o2));
        // return the value of o2 if o1 and o2 are different
        if ( same != 0 ) {
          // set o2 prop into diff
          this.set(diff, this.get(o2));
          return true;
        }

        // return false if o1 and o2 are same
        return false;
      `
    },
    'Object fromString(String value)',
    'void setFromString(Object obj, String value) { this.set(obj, fromString(value));}',
    `void copyFromXML(X x, FObject obj, javax.xml.stream.XMLStreamReader reader) {
      // Moves reader to characters state in order for value reading for various data types (date, boolean, short ...)
      int eventType = javax.xml.stream.XMLStreamConstants.END_ELEMENT;
      try {
        eventType = reader.next();

        // Handle partial data read for values that span multiple getText calls
        if ( eventType == javax.xml.stream.XMLStreamConstants.CHARACTERS ) {
          StringBuilder text = new StringBuilder();
          do {
            text.append(reader.getText());
            if ( reader.hasNext() ) {
              eventType = reader.next();
            } else {
              break;
            }
          } while ( eventType == javax.xml.stream.XMLStreamConstants.CHARACTERS );
          set(obj, fromString(text.toString()));

        // Ignore empty. (eg. <foo></foo>)
        } else if ( eventType != javax.xml.stream.XMLStreamConstants.END_ELEMENT ) {
          set(obj, fromString(reader.getText()));
        }
      } catch (javax.xml.stream.XMLStreamException ex) {
        foam.core.logger.Logger logger = (foam.core.logger.Logger) x.get("logger");
        logger.error("Premature end of XML file");
      }
    }`,
    'int comparePropertyToObject(Object key, Object o)',
    'String getSQLType()',
    'boolean includeInID() { return false; }',
    'boolean isSet(Object obj)',
    'boolean isDefaultValue(Object obj)',
    'void setStatementValue(IndexedPreparedStatement stmt, FObject o) throws java.sql.SQLException',
    'void setFromResultSet(java.sql.ResultSet resultSet, int index, FObject o) throws java.sql.SQLException',
    'void cloneProperty(FObject source, FObject dest) { set(dest, foam.util.SafetyUtil.deepClone(get(source))); }',
    `void validateObj(foam.lang.X x, foam.lang.FObject obj) {
       /* Template Method: override in subclass if required. */
       if ( getRequired() && (! isSet(obj) || isDefaultValue(obj)) ) {
         throw new PropertyRequiredException();
       }
    }`,
    'void fromCSVLabelMapping(java.util.Map<String,foam.lib.csv.FromCSVSetter> map)',
    'boolean getSheetsOutput() { return false; }',
    'Object castObject(Object value) { return value; }'
  ]
});
