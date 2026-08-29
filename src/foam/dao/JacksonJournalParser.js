/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'JacksonJournalParser',
  flags: ['java'],

  documentation: `
    A fast JSON parser for journal replay that uses Jackson to tokenize
    the JSON and FOAM PropertyInfo.set()/cast() to populate FObjects.

    Handles all property types: simple scalars, Enum (ordinal), Reference (id),
    nested FObjects (recursive), FObjectArrays, and arrays. The JSON form in
    journals is standard enough for Jackson with ALLOW_UNQUOTED_FIELD_NAMES.

    Benchmark reference only: gives the replay benchmark a ceiling to compare
    the FOAM combinator parser against. Not wired into any replay path.
  `,

  javaImports: [
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.AbstractFObjectPropertyInfo',
    'foam.lang.AbstractFObjectArrayPropertyInfo',
    'foam.lang.AbstractArrayPropertyInfo',
    'com.fasterxml.jackson.core.JsonParser',
    'com.fasterxml.jackson.databind.ObjectMapper',
    'java.util.HashMap',
    'java.util.Iterator',
    'java.util.List',
    'java.util.Map'
  ],

  javaCode: `
    // Singleton ObjectMapper — thread-safe, reused across all parsers
    private static final ObjectMapper MAPPER = new ObjectMapper();
    static {
      MAPPER.configure(JsonParser.Feature.ALLOW_UNQUOTED_FIELD_NAMES, true);
      MAPPER.configure(JsonParser.Feature.ALLOW_SINGLE_QUOTES, true);
    }

    /**
     * Build a property lookup map (name + shortName -> PropertyInfo).
     * Call once per DAO at replay start.
     */
    public static HashMap<String, PropertyInfo> buildPropertyMap(ClassInfo ci) {
      HashMap<String, PropertyInfo> map = new HashMap<>();
      List props = ci.getAxiomsByClass(PropertyInfo.class);
      Iterator iter = props.iterator();
      while ( iter.hasNext() ) {
        PropertyInfo pi = (PropertyInfo) iter.next();
        map.put(pi.getName(), pi);
        if ( pi.getShortName() != null ) {
          map.put(pi.getShortName(), pi);
        }
      }
      return map;
    }

    /**
     * Recursively convert a Jackson-parsed Map into an FObject.
     * Resolves the class from the "class" key in the map, or uses defaultCI.
     * Nested FObjects and arrays are handled recursively.
     */
    public static FObject mapToFObject(Map<String, Object> map, ClassInfo defaultCI) {
      try {
        // Resolve class — check for explicit "class" key first
        ClassInfo ci = defaultCI;
        Object className = map.get("class");
        if ( className instanceof String ) {
          try {
            ci = (ClassInfo) Class.forName((String) className).getMethod("getOwnClassInfo").invoke(null);
          } catch (Exception e) {
            // Class not found — return null so caller falls back to FOAM parser
            return null;
          }
        }
        if ( ci == null ) return null;

        FObject obj = (FObject) ci.newInstance();
        HashMap<String, PropertyInfo> propMap = buildPropertyMap(ci);

        for ( Map.Entry<String, Object> entry : map.entrySet() ) {
          String key = entry.getKey();
          if ( "class".equals(key) ) continue;

          PropertyInfo pi = propMap.get(key);
          if ( pi == null ) continue;

          Object val = entry.getValue();
          if ( val == null ) continue;

          try {
            if ( val instanceof Map ) {
              // Nested FObject — resolve and populate recursively.
              // If resolution fails (class not found), return null so
              // the whole entry falls back to FOAM parser.
              FObject nested = mapToFObject((Map<String, Object>) val, null);
              if ( nested == null ) return null;
              pi.set(obj, nested);
            } else if ( val instanceof List ) {
              // Array — could be FObjectArray, StringArray, or plain array
              List list = (List) val;
              if ( ! list.isEmpty() && list.get(0) instanceof Map ) {
                // Array of FObjects
                FObject[] arr = new FObject[list.size()];
                for ( int i = 0 ; i < list.size() ; i++ ) {
                  FObject item = mapToFObject((Map<String, Object>) list.get(i), null);
                  if ( item == null ) return null;
                  arr[i] = item;
                }
                pi.set(obj, arr);
              } else {
                // Array of scalars — the generated setter takes a typed array,
                // so a raw List would fail the cast and leave the property empty.
                boolean allStrings = true;
                for ( Object o : list ) if ( ! (o instanceof String) ) { allStrings = false; break; }
                pi.set(obj, allStrings ? list.toArray(new String[0]) : list.toArray());
              }
            } else {
              // Jackson gives Integer for numbers <= MAX_INT, Long for larger.
              // FOAM Long/Date/Reference setters expect Long. Promote.
              // BUT Enum.cast() checks (o instanceof Integer) for forOrdinal()
              // so DON'T promote for Enum properties.
              if ( val instanceof Integer && ! (pi instanceof foam.lang.AbstractEnumPropertyInfo) ) {
                pi.set(obj, ((Integer) val).longValue());
              } else {
                pi.set(obj, val);
              }
            }
          } catch (Exception e) {
            // Skip properties that fail — matches FOAM parser behavior
          }
        }
        return obj;
      } catch (Exception e) {
        return null;
      }
    }
  `,

  properties: [
    {
      class: 'Object',
      name: 'targetClassInfo',
      javaType: 'foam.lang.ClassInfo'
    },
    {
      class: 'Object',
      name: 'propertyMap',
      javaType: 'java.util.HashMap<String, foam.lang.PropertyInfo>',
      javaFactory: `return buildPropertyMap(getTargetClassInfo());`
    }
  ],

  methods: [
    {
      name: 'normalizeString',
      documentation: 'Normalize FOAM-specific string delimiters to standard JSON. Handles triple-quoted strings and backtick template literals.',
      type: 'String',
      args: 'String data',
      javaCode: `
        // Fast path: most entries have no special delimiters
        if ( data.indexOf('\\u0060') < 0 && data.indexOf("\\"\\"\\"\\"") < 0 ) return data;

        StringBuilder sb = new StringBuilder(data.length());
        int i = 0;
        int len = data.length();
        while ( i < len ) {
          // Check for triple-quoted string: """..."""
          if ( i + 2 < len && data.charAt(i) == '"' && data.charAt(i+1) == '"' && data.charAt(i+2) == '"' ) {
            int end = data.indexOf("\\"\\"\\"\\"", i + 3);
            if ( end < 0 ) { sb.append(data, i, len); break; }
            String content = data.substring(i + 3, end);
            // Escape for JSON: replace newlines, tabs, backslashes, internal quotes
            sb.append('"');
            for ( int j = 0 ; j < content.length() ; j++ ) {
              char c = content.charAt(j);
              switch ( c ) {
                case '\\n': sb.append("\\\\n"); break;
                case '\\r': sb.append("\\\\r"); break;
                case '\\t': sb.append("\\\\t"); break;
                case '"':  sb.append("\\\\\\"\\""); break;
                case '\\\\': sb.append("\\\\\\\\"); break;
                default:   sb.append(c);
              }
            }
            sb.append('"');
            i = end + 3;
            continue;
          }
          // Check for backtick template literal
          if ( data.charAt(i) == '\\u0060' ) {
            int end = data.indexOf('\\u0060', i + 1);
            if ( end < 0 ) { sb.append(data, i, len); break; }
            String content = data.substring(i + 1, end);
            sb.append('"');
            for ( int j = 0 ; j < content.length() ; j++ ) {
              char c = content.charAt(j);
              switch ( c ) {
                case '\\n': sb.append("\\\\n"); break;
                case '\\r': sb.append("\\\\r"); break;
                case '\\t': sb.append("\\\\t"); break;
                case '"':  sb.append("\\\\\\"\\""); break;
                case '\\\\': sb.append("\\\\\\\\"); break;
                default:   sb.append(c);
              }
            }
            sb.append('"');
            i = end + 1;
            continue;
          }
          sb.append(data.charAt(i));
          i++;
        }
        return sb.toString();
      `
    },
    {
      name: 'parseString',
      type: 'FObject',
      args: 'String data',
      javaCode: `
        try {
          data = normalizeString(data);
          Map<String, Object> map = MAPPER.readValue(data, Map.class);

          // If any value is a nested Map or List-of-Maps, bail out —
          // FOAM's class resolution + context injection is needed for
          // nested FObjects and FObjectArrays.
          for ( Object val : map.values() ) {
            if ( val instanceof Map ) return null;
            if ( val instanceof List ) {
              List l = (List) val;
              if ( ! l.isEmpty() && l.get(0) instanceof Map ) return null;
            }
          }

          return mapToFObject(map, getTargetClassInfo());
        } catch (Exception e) {
          return null;
        }
      `
    }
  ]
});
