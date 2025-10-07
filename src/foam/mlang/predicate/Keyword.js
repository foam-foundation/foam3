/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.mlang.predicate',
  name: 'Keyword',
  extends: 'foam.mlang.predicate.Unary',
  implements: [ 'foam.lang.Serializable' ],

  javaImports: [
    'foam.lang.PropertyInfo',
    'java.lang.reflect.Method',
    'java.text.DateFormat',
    'java.text.SimpleDateFormat',
    'java.util.Date',
    'java.util.Iterator',
    'java.util.List',
    'java.util.TimeZone'
  ],

  documentation: 'Unary Predicate for generic keyword search (searching all String properties for argument substring).',

  requires: [
    {
      name: 'String',
      path: 'foam.lang.String',
      flags: ['js'],
    },
    {
      name: 'FObjectProperty',
      path: 'foam.lang.FObjectProperty',
      flags: ['js'],
    },
    {
      name: 'Long',
      path: 'foam.lang.Long',
      flags: ['js']
    },
    {
      name: 'Enum',
      path: 'foam.lang.Enum',
      flags: ['js']
    },
    {
      name: 'Date',
      path: 'foam.lang.Date',
      flags: ['js']
    }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'checkingNestedFObject_',
      value: false,
      transient: true,
      visibility: 'HIDDEN',
      documentation: 'Support keyword search on the first level nested FObject.'
    }
  ],

  methods: [
    {
      name: 'f',
      code: function f(obj) {
        var arg = this.arg1.f(obj);
        if ( ! arg || typeof arg !== 'string' ) return false;

        arg = arg.toLowerCase();

        var s = '';
        const props = obj.cls_.getAxiomsByClass(foam.lang.Property);
        for ( let i = 0 ; i < props.length ; i++ ) {
          try {
            const prop = props[i];
            if ( this.FObjectProperty.isInstance(prop) ) {
              if ( this.checkNestedFObject(prop.f(obj)) ) return true;
            } else if ( this.Enum.isInstance(prop) ) {
              s = prop.f(obj).label.toLowerCase();
            } else if ( this.Long.isInstance(prop) ) {
              s = prop.f(obj).toString().toLowerCase();
            } else if ( this.Date.isInstance(prop) ) {
              s = prop.f(obj).toISOString().toLowerCase();
            } else {
              s = prop.f(obj);

              s = String(s);
            }
          } catch (err) {}
          if ( s.toLowerCase().includes(arg) ) return true;
        }

        return false;
      },
      javaCode: `
if ( ! ( getArg1().f(obj) instanceof String ) ) return false;

String arg1 = ((String) getArg1().f(obj)).toUpperCase();
List props = ((foam.lang.FObject) obj).getClassInfo().getAxiomsByClass(PropertyInfo.class);
Iterator i = props.iterator();

while ( i.hasNext() ) {
  PropertyInfo prop = (PropertyInfo) i.next();

  try {
    String s = "";
    if ( prop instanceof foam.lang.AbstractFObjectPropertyInfo ) {
      if ( checkNestedFObject(prop.f(obj)) ) return true;
      setCheckingNestedFObject_(false);
    } else if ( prop instanceof foam.lang.AbstractEnumPropertyInfo ) {
      Object value = prop.f(obj);
      if ( value == null ) continue;
      Class c = value.getClass();
      try {
        Method m = c.getMethod("getLabel");
        s = (String) m.invoke(value);
      } catch (Throwable t) {
        s = value.toString();
      }
    } else if ( prop instanceof foam.lang.AbstractLongPropertyInfo ) {
      s = Long.toString((long) prop.f(obj));
    } else if ( prop instanceof foam.lang.AbstractDatePropertyInfo ) {
      Date d = (Date) prop.f(obj);
      if ( d == null ) continue;

      // We do this to match JavaScript's 'toISOString' method which we use to
      // display dates in tables.
      DateFormat df = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm'Z'"); // Quoted "Z" to indicate UTC, no timezone offset
      df.setTimeZone(TimeZone.getTimeZone("UTC"));
      s = df.format(d);
    } else if ( ! ( prop instanceof foam.lang.AbstractStringPropertyInfo ) ) {
      continue;
    } else {
      s = ((String) prop.f(obj));
    }

    if ( s != null && s.toUpperCase().contains(arg1) ) return true;
  } catch (Throwable t) {}
}

return false;`
    },
    {
      name: 'checkNestedFObject',
      type: 'Boolean',
      args: [
        { name: 'obj', type: 'Any' }
      ],
      code: function(obj) {
        if ( obj === undefined || obj === null || this.checkingNestedFObject_ ) {
          return false;
        }
        this.checkingNestedFObject_ = true;
        return this.f(obj);
      },
      javaCode: `
        if ( obj == null || getCheckingNestedFObject_() ) return false;
        setCheckingNestedFObject_(true);
        return this.f(obj);
      `
    },
    {
      name: 'toString',
      code: function() { return 'Keyword(' + this.arg1.toString() + ')'; },
      javaCode: 'return "Keyword(" + getArg1().toString() + ")";'
    },
    function toMQL() {
      // no-op
    }
  ]
});


/** Map sink transforms each put with a given mapping expression. */
