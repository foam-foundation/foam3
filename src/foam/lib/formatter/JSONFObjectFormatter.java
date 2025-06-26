/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.formatter;

import foam.lang.*;
import foam.lib.json.OutputJSON;
import foam.util.SafetyUtil;
import java.lang.reflect.Array;
import java.text.SimpleDateFormat;
import java.util.*;

/*

A faster alternative to the older foam.lib.json.Outputter.

Better performance is achieved with:

1. faster escaping
2. not escaping class names and property names
3. not quoting property keys
4. using short names
5. using a smaller format for enums and dates
6. having PropertyInfos output directly from primitive
7. supporting outputting directly to another Visitor,
   StringBuilder, OutputStream, etc. without converting
   to String.
8. Using a Fast TimeStamper

*/

/* Example use:
  protected static final ThreadLocal<foam.lib.formatter.FObjectFormatter> formatter_ = new ThreadLocal<foam.lib.formatter.FObjectFormatter>() {
        @Override
        protected foam.lib.formatter.JSONFObjectFormatter initialValue() {
          foam.lib.formatter.JSONFObjectFormatter formatter = new foam.lib.formatter.JSONFObjectFormatter();
          formatter.setQuoteKeys(true);
          formatter.setPropertyPredicate(new foam.lib.AndPropertyPredicate(new foam.lib.PropertyPredicate[] {new foam.lib.NetworkPropertyPredicate(), new foam.lib.PermissionedPropertyPredicate()}));
          return formatter;
        }

       @Override
       public FObjectFormatter get() {
         FObjectFormatter formatter = super.get();
         formatter.setX(getX());
         formatter.reset();
         return formatter;
       }
    };
  ...
  foam.lib.formatter.FObjectFormatter formatter = formatter_.get();
  formatter.output(fObj);
  writer.append(formatter.builder());
*/

public class JSONFObjectFormatter
  extends AbstractFObjectFormatter
{

  protected static ThreadLocal<foam.util.FastTimestamper> timestamper_ = new ThreadLocal<foam.util.FastTimestamper>() {
    @Override
    protected foam.util.FastTimestamper initialValue() {
      foam.util.FastTimestamper ft = new foam.util.FastTimestamper();
      return ft;
    }
  };

  // if set to true, then produces "name":"kristina", otherwise name:"kristina"
  protected boolean quoteKeys_                       = false;

  // if set to true and property has a short name, uses that as a key: fn:"kristina", otherwise: firstName:"kristina"
  protected boolean outputShortNames_                = false;

  // if set to true, outputs properties and their default values that were not explicitly set
  protected boolean outputDefaultValues_             = false;

  // if set to true, appends escaped new line character
  protected boolean multiLineOutput_                 = false;

  // when set to true check whether the object of the same class as dao.of, if so doesn't output top level classname
  protected boolean outputClassNames_                = true;

  // if set to true formats dates into readable date format otherwise outputs in milliseconds
  protected boolean outputReadableDates_             = false;

  // when set to true and property is an FObjectProperty, checks whether property value matches specified class.
  // if matches then doesn't output the class name, otherwise(if a subclasss or interface implementation) outputs.
  // TODO: should be combined with outputClassNames_?
  protected boolean outputDefaultClassNames_         = true;

  protected boolean calculateDeltaForNestedFObjects_ = true;

  public JSONFObjectFormatter(X x) {
    super(x);
  }

  public JSONFObjectFormatter() {
    super();
  }

  protected void outputUndefined() {
  }

  protected void outputNull() {
  }

  public void output(String s) {
    if ( multiLineOutput_ && s.indexOf('\n') >= 0 ) {
      append("\n\"\"\"");
      escapeAppend(s);
      append("\"\"\"");
    } else {
      append('"');
      escapeAppend(s);
      append('"');
    }
  }

  public void escapeAppend(String s) {
    if ( s == null ) return;
    foam.lib.json.Util.escape(s, builder());
  }

  public void output(short val) { append(val); }


  public void output(int val) { append(val); }


  public void output(long val) { append(val); }


  public void output(float val) { append(val); }


  public void output(double val) { append(val); }


  public void output(boolean val) { append(val); }


  protected void outputNumber(Number value) { append(value); }

  public void output(String[] arr) { output((Object[]) arr); }

  public void output(Object[] array) {
    if ( array == null ) return;

    append('[');
    for ( int i = 0 ; i < array.length ; i++ ) {
      output(array[i]);
      if ( i < array.length - 1 ) append(',');
    }
    append(']');
  }

  public void output(byte[][] array) {
    if ( array == null ) return;

    append('[');
    if ( array != null ) {
      for ( int i = 0 ; i < array.length ; i++ ) {
        output(array[i]);
        if ( i < array.length - 1 ) append(',');
      }
    }
    append(']');
  }

  public void output(byte[] array) {
    output(foam.util.SecurityUtil.ByteArrayToHexString(array));
  }

  public void output(Map map) {
    if ( map == null ) return;

    append('{');
    Iterator keys = map.keySet().iterator();
    while ( keys.hasNext() ) {
      Object key   = keys.next();
      Object value = map.get(key);
      output(key == null ? "" : key.toString());
      append(':');
      output(value);
      if ( keys.hasNext() ) append(',');
    }
    append('}');
  }

  public void output(List list) {
    if ( list == null ) return;

    append('[');
    Iterator iter = list.iterator();
    while ( iter.hasNext() ) {
      output(iter.next());
      if ( iter.hasNext() ) append(',');
    }
    append(']');
  }

  protected void outputProperty(FObject o, PropertyInfo p) {
    try {
      outputKey(getPropertyName(p));
      append(':');
      p.formatJSON(this, o);
    } catch (Throwable t) {
      System.err.println("***************************************************** error outputting " + getPropertyName(p));
      System.err.println("" + p.get(o));
      t.printStackTrace();
    }
  }


  protected void outputFObjectPropertyHeader(PropertyInfo prop) {
    if ( prop == null ) return;
    append(',');
    addInnerNewline();
    outputKey(getPropertyName(prop));
    append(':');
  }


  protected boolean maybeOutputFObjectProperty(FObject newFObject, FObject oldFObject, PropertyInfo prop) {
    if ( newFObject instanceof foam.lib.json.OutputJSON ) {
      if ( newFObject.equals(oldFObject) ) return false;
      ((foam.lib.json.OutputJSON) newFObject).formatJSON(this);
      return true;
    }

    if ( prop instanceof AbstractFObjectPropertyInfo && oldFObject != null &&
      prop.get(oldFObject) != null && prop.get(newFObject) != null
    ) {
      return maybeOutputDelta(((FObject) prop.get(oldFObject)), ((FObject) prop.get(newFObject)), prop, null);
    }

    append(',');
    addInnerNewline();
    outputProperty(newFObject, prop);
    return true;
  }
/*
  public void outputMap(Object... values) {
    if ( values.length % 2 != 0 ) {
      throw new RuntimeException("Need even number of arguments for outputMap");
    }

    append("{");
    int i = 0;
    while ( i < values.length ) {
      append(beforeKey_());
      append(values[i++].toString());
      append(afterKey_());
      append(":");
      output(values[i++]);
      if ( i < values.length ) append(",");
    }
    append("}");
  }
  */


  public void outputEnumValue(FEnum value) {
    append('{');
    outputKey("class");
    append(':');
    output(value.getClass().getName());
    append(',');
    outputKey("ordinal");
    append(':');
    outputNumber(value.getOrdinal());
    append('}');
  }

  public void outputEnum(FEnum value) {
    output(value.getOrdinal());
  }

  public void output(Object value) {
    if ( value == null ) {
      append("null");
    } else if ( value instanceof OutputJSON ) {
      ((OutputJSON) value).formatJSON(this);
    } else if ( value instanceof String ) {
      output((String) value);
    } else if ( value instanceof FEnum ) {
      outputEnumValue((FEnum) value);
    } else if ( value instanceof FObject ) {
      output((FObject) value);
    } else if ( value instanceof PropertyInfo) {
      output((PropertyInfo) value);
    } else if ( value instanceof ClassInfo ) {
      output((ClassInfo) value);
    } else if ( value instanceof Number ) {
      outputNumber((Number) value);
    } else if ( isArray(value) ) {
      if ( value.getClass().equals(byte[][].class) ) {
        output((byte[][]) value);
      } else if ( value instanceof byte[] ) {
        output((byte[]) value);
      } else {
        output((Object[]) value);
      }
    } else if ( value instanceof Boolean ) {
      output(((Boolean) value).booleanValue());
    } else if ( value instanceof Date ) {
      outputDateValue((Date) value);
    } else if ( value instanceof Map ) {
      output((Map) value);
    } else if ( value instanceof List ) {
      output((List) value);
    } else {
      String s = builder().toString();
      foam.core.logger.StdoutLogger.instance().error(this.getClass().getSimpleName() + ".output, Unexpected value type:", value.getClass().getName(), "value:", value, "builder:", s.substring(0, Math.min(400, s.length())),"...",s.substring(Math.max(0, s.length() - 500)));
      append("null");
    }
  }

  protected boolean isArray(Object value) {
    return value != null &&
      ( value.getClass() != null ) &&
      value.getClass().isArray();
  }

  /** Called when outputting a Date from an Object field so that the type is know. **/
  public void outputDateValue(Date date) {
    append("{\"class\":\"__Timestamp__\",\"value\":");
    if ( outputReadableDates_ ) {
      outputReadableDate(date);
    } else {
      outputNumber(date.getTime());
    }
    append('}');
  }

  public void output(Date date) {
    if ( date != null ) {
      output(date.getTime());
    } else {
      append("null");
    }
  }

  public void outputReadableDate(Date date) {
    if ( date != null ) {
      outputReadableDate(date.getTime());
    } else {
      output("null");
    }
  }

  public void outputReadableDate(Long time) {
    output(timestamper_.get().createTimestamp(time));
  }

  protected boolean maybeOutputProperty(FObject fo, PropertyInfo prop, boolean includeComma) {
    if ( ! outputDefaultValues_ ) {
      if ( ! prop.isSet(fo) ) return false;

      // TODO: This isn't safe for all property types (for unknown reason), so just restrict
      // to safe classes for now.
      if ( prop instanceof foam.lang.AbstractStringPropertyInfo || prop instanceof foam.lang.AbstractIntPropertyInfo || prop instanceof foam.lang.AbstractBooleanPropertyInfo )
        if ( prop.isDefaultValue(fo) ) return false;
    }

    Object value = prop.get(fo);
    if ( value == null || ( isArray(value) && Array.getLength(value) == 0 ) || ( value instanceof FObject && value.equals(fo) ) ) {
      return false;
    }

    if ( includeComma ) append(',');
    if ( multiLineOutput_ ) addInnerNewline();
    outputProperty(fo, prop);
    return true;
  }

  public boolean maybeOutputDelta(FObject oldFObject, FObject newFObject, PropertyInfo parentProp, ClassInfo defaultClass) {
    if ( newFObject instanceof foam.lib.json.OutputJSON ) {
      if ( newFObject.equals(oldFObject) ) return false;

      outputFObjectPropertyHeader(parentProp);
      ((foam.lib.json.OutputJSON) newFObject).formatJSON(this);
      return true;
    }

    ClassInfo newInfo  = newFObject.getClassInfo();
    String    of       = newInfo.getObjClass().getSimpleName().toLowerCase();
    List      axioms   = getProperties(parentProp, newInfo);
    int       size     = axioms.size();
    int       ids      = 0;
    int       delta    = 0;
    int       optional = 0;
    int       len      = builder().length(); // Safe pos in case we want to undo

    outputFObjectPropertyHeader(parentProp);

    append('{');
    addInnerNewline();
    if ( outputClassNames_ && ( outputDefaultClassNames_ || newInfo != defaultClass ) ) {
      outputKey("class");
      append(':');
      output(newInfo.getId());
    }

    for ( int i = 0 ; i < size ; i++ ) {
      PropertyInfo prop = (PropertyInfo) axioms.get(i);
      if ( prop.includeInID() || compare(prop, oldFObject, newFObject) != 0 ) {
        if ( parentProp == null && prop.includeInID() ) {
          // IDs only relevant on root objects
          append(',');
          addInnerNewline();
          outputProperty(newFObject, prop);
          ids += 1;
        } else {
          if ( calculateDeltaForNestedFObjects_ &&
               prop.get(newFObject) != null && prop.get(oldFObject) != null &&
               prop.get(newFObject).getClass().getCanonicalName().equals(prop.get(oldFObject).getClass().getCanonicalName()) ) {
            if ( maybeOutputFObjectProperty(newFObject, oldFObject, prop) ) {
              delta += 1;
              if ( optionalPredicate_.propertyPredicateCheck(getX(), of, prop) ) {
                optional += 1;
              }
            }
          } else {
            append(',');
            addInnerNewline();
            outputProperty(newFObject, prop);
            delta += 1;
            if ( optionalPredicate_.propertyPredicateCheck(getX(), of, prop) ) {
              optional += 1;
            }
          }
        }
      }
    }

    if ( delta > optional ) {
      addInnerNewline();
      append('}');

      return true;
    }

    // Return false when either no delta or the delta are from ids and storage
    // optional properties
    builder().setLength(len);
    return false;
  }

  protected void addInnerNewline() {
    if ( multiLineOutput_ ) {
      append('\n');
    }
  }

/*
  public void outputJSONJFObject(FObject o) {
    append("p(");
    outputFObject(o);
    append(")\r\n");
  }
  */

  public void output(FObject[] arr, ClassInfo defaultClass, PropertyInfo parentProp) {
    append('[');
    for ( int i = 0 ; i < arr.length ; i++ ) {
      output(arr[i], defaultClass, parentProp);
      if ( i < arr.length - 1 ) append(',');
    }
    append(']');
  }

  public void output(FObject o) {
    output(o, null, null);
  }

  public void output(FObject o, ClassInfo defaultClass) {
    output(o, defaultClass, null);
  }

  public void output(FObject o, ClassInfo defaultClass, PropertyInfo parentProp) {
    if ( o == null ) {
      append("null");
      return;
    }

    if ( o instanceof foam.lib.json.OutputJSON ) {
      ((foam.lib.json.OutputJSON) o).formatJSON(this);
      return;
    }

    int       len   = builder().length(); // Safe pos in case we want to undo
    int       props = 0;
    ClassInfo info  = o.getClassInfo();

    boolean outputClass = outputClassNames_ || ( outputDefaultClassNames_ && info != defaultClass );

    append('{');
    addInnerNewline();
    if ( outputClass ) {
      outputKey("class");
      append(':');
      output(info.getId());
    }
    boolean outputComma = outputClass;

    List axioms = getProperties(parentProp, info);
    int  size   = axioms.size();
    for ( int i = 0 ; i < size ; i++ ) {
      PropertyInfo prop = (PropertyInfo) axioms.get(i);
      outputComma = maybeOutputProperty(o, prop, outputComma) || outputComma;
      if ( outputComma ) props++;
    }

    if ( props > 0 || outputDefaultClassNames_ ) {
      addInnerNewline();
      append('}');
    } else {
      // skip outputting just class:
      builder().setLength(len);
    }
  }

  public void output(PropertyInfo prop) {
    append('{');
    outputKey("class");
    append(':');
    output("__Property__");
    append(',');
    outputKey("forClass_");
    append(':');
    output(prop.getClassInfo().getId());
    append(',');
    outputKey("name");
    append(':');
    output(prop.getName());
//    if ( quoteKeys_ ) {
//      output(getPropertyName(prop));
//    } else {
//      outputRawString(getPropertyName(prop));
//    }
    append('}');
  }

  public void outputJson(String str) {
    if ( ! quoteKeys_ ) str = str.replaceAll("\"class\"", "class");
    outputFormattedString(str);
  }

  public void output(ClassInfo info) {
    output(info.getId());
//    append('{');
//    if ( quoteKeys_ ) append(beforeKey_());
//    append("class");
//    if ( quoteKeys_ ) append(afterKey_());
//    append(":");
//    append("\"__Class__\"");
//    append(":");
//    append("{\"class\":\"__Class__\",\"forClass_\":");
//    output(info.getId());
//    append('}');
  }

  protected void appendQuote() {
    append('"');
  }

  public String getPropertyName(PropertyInfo p) {
    return outputShortNames_ && ! SafetyUtil.isEmpty(p.getShortName()) ? p.getShortName() : p.getName();
  }

  public void outputFormattedString(String str) {
    append(str);
  }

  public JSONFObjectFormatter setQuoteKeys(boolean quoteKeys) {
    quoteKeys_ = quoteKeys;
    return this;
  }

  public JSONFObjectFormatter setOutputShortNames(boolean outputShortNames) {
    outputShortNames_ = outputShortNames;
    return this;
  }

  public JSONFObjectFormatter setOutputDefaultValues(boolean outputDefaultValues) {
    outputDefaultValues_ = outputDefaultValues;
    return this;
  }

  public JSONFObjectFormatter setOutputDefaultClassNames(boolean f) {
    outputDefaultClassNames_ = f;
    return this;
  }

  public JSONFObjectFormatter setOutputReadableDates(boolean f) {
    outputReadableDates_ = f;
    return this;
  }

  public JSONFObjectFormatter setMultiLine(boolean ml) {
    multiLineOutput_ = ml;
    return this;
  }

  public JSONFObjectFormatter setOutputClassNames(boolean outputClassNames) {
    outputClassNames_ = outputClassNames;
    return this;
  }

  public void setCalculateDeltaForNestedFObjects(boolean calculateDeltaForNestedFObjects) {
    this.calculateDeltaForNestedFObjects_ = calculateDeltaForNestedFObjects;
  }

  public void outputKey(String val) {
    if ( quoteKeys_ ) appendQuote();
    append(val);
    if ( quoteKeys_ ) appendQuote();
  }

  public void output(float val, int precision) {
    // TODO: faster
    append(String.format("%." + precision + "f", val));
  }

  public void output(double val, int precision) {
    // TODO: faster
    append(String.format("%." + precision + "f", val));
  }

}
