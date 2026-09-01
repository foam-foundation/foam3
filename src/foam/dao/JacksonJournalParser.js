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

    Handles scalars, Enum (ordinal), Reference (id), class references, arrays,
    and nested FObjects with a Java class. Returns null (never a partial object)
    for anything else: triple-quoted or backtick strings, JS-only classes,
    values a setter rejects. Every null carries its reason in lastError.

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
      MAPPER.configure(JsonParser.Feature.ALLOW_TRAILING_COMMA, true);
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
    /** Thread-local reason for the last null from mapToFObject; surfaced through lastError. */
    private static final ThreadLocal<String> WHY = new ThreadLocal<>();

    public static FObject mapToFObject(Map<String, Object> map, ClassInfo defaultCI) {
      try {
        // Resolve class — check for explicit "class" key first
        ClassInfo ci = defaultCI;
        Object className = map.get("class");
        if ( className instanceof String ) {
          try {
            ci = (ClassInfo) Class.forName((String) className).getMethod("getOwnClassInfo").invoke(null);
          } catch (Exception e) {
            WHY.set("no Java class for " + className + ": " + e.getClass().getSimpleName());
            return null;
          }
        }
        if ( ci == null ) { WHY.set("nested object without class key"); return null; }

        FObject obj = (FObject) ci.newInstance();
        // FOAM's FObjectParser creates every object in the parser context
        // (FObjectParser.java:124-125); factories that read getX() need the same.
        foam.lang.X x = foam.lang.XLocator.get();
        if ( x != null ) obj.setX(x);
        HashMap<String, PropertyInfo> propMap = buildPropertyMap(ci);

        for ( Map.Entry<String, Object> entry : map.entrySet() ) {
          String key = entry.getKey();
          if ( "class".equals(key) ) continue;

          PropertyInfo pi = propMap.get(key);
          if ( pi == null ) continue;

          Object val = entry.getValue();
          if ( val == null ) continue;

          // Plain string values take the same dedup path as the FOAM parser so
          // the two parsers compare like with like on memory.
          if ( val instanceof String && pi.getValueClass() != ClassInfo.class ) {
            pi.set(obj, foam.lib.json.StringParser.dedup((String) val));
            continue;
          }

          // A class reference is written as a plain string ("of":"foam.core.ticket.Ticket");
          // FOAM's ClassReferenceParser resolves it to a ClassInfo, so do the same.
          if ( val instanceof String && pi.getValueClass() == ClassInfo.class ) {
            ClassInfo ref = foam.lang.XLocator.get().getClassInfo((String) val);
            if ( ref == null ) { WHY.set("unresolved class reference " + val + " for " + key); return null; }
            pi.set(obj, ref);
            continue;
          }

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
                if ( allStrings ) {
                  String[] arr = new String[list.size()];
                  for ( int i = 0 ; i < arr.length ; i++ ) arr[i] = foam.lib.json.StringParser.dedup((String) list.get(i));
                  pi.set(obj, arr);
                } else {
                  pi.set(obj, list.toArray());
                }
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
            // A value the setter rejects means this parser does not understand the
            // entry. Fail closed so the caller falls back, never return a partial object.
            WHY.set("setter rejected " + ci.getId() + "." + key + "=" + val + ": " + e);
            return null;
          }
        }
        return obj;
      } catch (Exception e) {
        WHY.set("mapToFObject: " + e);
        return null;
      }
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'lastError',
      transient: true,
      documentation: 'Why the last parseString returned null (nested bail, unresolved class, rejected value, Jackson syntax error).'
    },
    {
      class: 'Boolean',
      name: 'bailOnNested',
      value: true,
      documentation: 'Return null for any entry with a nested object or object array, leaving it to the FOAM parser. Off lets mapToFObject resolve nested classes itself.'
    },
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
      name: 'parseString',
      type: 'FObject',
      args: 'String data',
      javaCode: `
        setLastError("");
        WHY.remove();
        // Triple-quoted and backtick strings are FOAM string grammar with their own
        // escape rules (foam.lib.json.StringParser); translating them to JSON is not
        // equivalent, so refuse the entry and let the FOAM parser handle it.
        if ( data.indexOf('\u0060') >= 0 || data.indexOf("\\"\\"\\"") >= 0 ) {
          setLastError("FOAM string grammar (triple-quote or backtick)");
          return null;
        }
        try {
          Map<String, Object> map = MAPPER.readValue(data, Map.class);

          // If any value is a nested Map or List-of-Maps, bail out —
          // FOAM's class resolution + context injection is needed for
          // nested FObjects and FObjectArrays.
          if ( getBailOnNested() ) {
            for ( Object val : map.values() ) {
              if ( val instanceof Map ) { setLastError("nested object (bailOnNested)"); return null; }
              if ( val instanceof List ) {
                List l = (List) val;
                if ( ! l.isEmpty() && l.get(0) instanceof Map ) { setLastError("nested object array (bailOnNested)"); return null; }
              }
            }
          }

          FObject result = mapToFObject(map, getTargetClassInfo());
          if ( result == null ) setLastError(WHY.get() == null ? "mapToFObject returned null" : WHY.get());
          return result;
        } catch (Exception e) {
          setLastError("Jackson: " + e.getMessage());
          return null;
        }
      `
    }
  ]
});
