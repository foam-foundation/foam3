/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.xml;

import foam.lang.ClassInfo;
import foam.lang.FObject;
import foam.lang.PropertyInfo;
import foam.lang.X;
import foam.lib.PropertyPredicate;
import foam.lib.json.OutputterMode;
import foam.util.SafetyUtil;
import java.io.*;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;
import org.apache.commons.io.IOUtils;

public class Outputter
  implements foam.lib.Outputter
{
  protected static DateTimeFormatter sdf = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
                                              .withZone(ZoneOffset.UTC);

  protected PrintWriter       writer_;
  protected OutputterMode     mode_;
  protected StringWriter      stringWriter_        = null;
  protected boolean           outputShortNames_    = false;
  protected boolean           outputDefaultValues_ = false;
  protected PropertyPredicate propertyPredicate_   = null;
  protected X                 x_                   = null;

  // Cached property lists per ClassInfo, keyed by ClassInfo id + attribute flag
  protected java.util.Map<String, List<PropertyInfo>> propertyMap_ = new java.util.HashMap<>();

  public Outputter(X x) {
    this(x, OutputterMode.FULL);
  }

  public Outputter(X x, OutputterMode mode) {
    this(x, (PrintWriter) null, mode);
  }

  public Outputter(X x, File file, OutputterMode mode) throws FileNotFoundException {
    this(x, new PrintWriter(file), mode);
  }

  public Outputter(X x, PrintWriter writer, OutputterMode mode) {
    if ( writer == null ) {
      stringWriter_ = new StringWriter();
      writer        = new PrintWriter(stringWriter_);
    }

    this.x_      = x;
    this.mode_   = mode;
    this.writer_ = writer;
  }

  public X getX() {
    return x_;
  }

  public Outputter setPropertyPredicate(PropertyPredicate predicate) {
    propertyPredicate_ = predicate;
    return this;
  }

  public PropertyPredicate getPropertyPredicate() {
    return propertyPredicate_;
  }

  protected void initWriter() {
    if ( stringWriter_ == null ) {
      stringWriter_ = new StringWriter();
      writer_ = new PrintWriter(stringWriter_);
    }
    stringWriter_.getBuffer().setLength(0);
  }

  @Override
  public String stringify(FObject obj) {
    initWriter();
    output(obj);
    return this.toString();
  }

  @Override
  public void output(Object value) {
    if ( value instanceof OutputXML ) {
      ((OutputXML) value).outputXML(this);
    } else if ( value instanceof String ) {
      outputString((String) value);
    } else if ( value instanceof FObject ) {
      outputFObject((FObject) value);
    } else if ( value instanceof Number ) {
      outputNumber((Number) value);
    } else if ( value instanceof Boolean ) {
      outputBoolean((Boolean) value);
    } else if ( value instanceof java.util.Date ) {
      outputDate((java.util.Date) value);
    } else if ( value instanceof Enum<?> ) {
      outputEnum((Enum<?>) value);
    } else if ( isArray(value) ) {
      if ( value.getClass().equals(byte[][].class) )
        outputByteArray((byte[][]) value);
      else
        outputArray((Object[]) value);
    }
  }

  protected boolean isArray(Object value) {
    return ( value != null ) &&
      ( value.getClass() != null ) &&
      value.getClass().isArray();
  }

  protected void outputString(String s) {
    writer_.append(s);
  }

  protected void outputFObject(FObject obj) {
    writer_.append("<").append(obj.getClass().getSimpleName());
    outputAttributes(obj);
    writer_.append(">");
    outputProperties_(obj);
    writer_.append("</").append(obj.getClass().getSimpleName()).append(">");
  }

  protected void outputNumber(Number value) {
    writer_.append(value.toString());
  }

  protected void outputBoolean(Boolean value) {
    writer_.append( value ? "true" : "false");
  }

  protected void outputDate(Date value) {
    writer_.append(sdf.format(value.toInstant()));
  }

  protected void outputEnum(Enum<?> value) {
    writer_.append(value.name());
  }

  public void outputProperties(FObject obj) {
    outputProperties_(obj);
  }

  /**
   * Get filtered properties for an FObject, applying PropertyPredicate if set.
   * Results are cached per ClassInfo for efficiency.
   */
  protected List<PropertyInfo> getProperties(FObject obj, boolean forAttributes) {
    ClassInfo info = obj.getClassInfo();
    String key = info.getId() + (forAttributes ? ":attr" : ":elem");

    List<PropertyInfo> properties = propertyMap_.get(key);
    if ( properties == null ) {
      String of = info.getSimpleName().toLowerCase();
      properties = info.getAxiomsByClass(PropertyInfo.class).stream()
        .filter(prop -> forAttributes ? prop.getXMLAttribute() : ! prop.getXMLAttribute())
        .filter(prop -> propertyPredicate_ == null || propertyPredicate_.propertyPredicateCheck(getX(), of, prop))
        .collect(Collectors.toList());
      propertyMap_.put(key, properties);
    }
    return properties;
  }

  protected void outputProperties_(FObject obj) {
    List<PropertyInfo> properties = getProperties(obj, false);
    for ( PropertyInfo prop : properties ) {
      outputProperty_(obj, prop);
    }
  }

  protected void outputArray(Object[] array) {
    for ( int i = 0 ; i < array.length ; i++ ) {
      output(array[i]);
    }
  }

  protected void outputByteArray(byte[][] array) {
    for ( int i = 0 ; i < array.length ; i++ ) {
      output(array[i]);
    }
  }

  protected void outputProperty_(FObject obj, PropertyInfo prop) {
    if ( mode_ == OutputterMode.NETWORK && prop.getNetworkTransient() ) return;
    if ( mode_ == OutputterMode.STORAGE && prop.getStorageTransient() ) return;
    if ( mode_ == OutputterMode.EXTERNAL && prop.getExternalTransient() ) return;
    if ( ! outputDefaultValues_ && ! prop.isSet(obj) ) return;

    Object value = prop.get(obj);
    if ( value == null || isArray(value) && ((Object[]) value).length == 0 ) {
      return;
    }

    outputProperty(value, prop);
  }

  protected void outputProperty(Object value, PropertyInfo prop) {
    if ( value instanceof Object[] ) {
      outputArrayProperty((Object[]) value, prop);
    } else if ( value instanceof FObject ) {
      if ( value instanceof OutputXML ) {
        ((OutputXML) value).outputXML(this);
      } else {
        outputFObjectProperty((FObject) value, prop);
      }
    } else {
      outputPrimitiveProperty(value, prop);
    }
  }

  protected void outputArrayProperty(Object[] values, PropertyInfo prop) {
    for ( Object value : values ) {
      outputProperty(value, prop);
    }
  }

  protected void outputFObjectProperty(FObject value, PropertyInfo prop) {
    Object text;
    if ( ( text = value.getProperty("text") ) == null ) {
      writer_.append("<").append(getPropertyName(prop)).append(">");
      outputProperties_(value);
      writer_.append("</").append(getPropertyName(prop)).append(">");
      return;
    }

    // write property name and attributes
    writer_.append("<").append(getPropertyName(prop));
    outputAttributes(value);
    writer_.append(">");

    if ( text instanceof FObject ) {
      prop.toXML(this, value);
    } else {
      prop.toXML(this, text);
    }

    writer_.append("</").append(getPropertyName(prop)).append(">");
  }

  protected void outputPrimitiveProperty(Object value, PropertyInfo prop) {
    writer_.append("<").append(getPropertyName(prop)).append(">");
    prop.toXML(this, value);
    writer_.append("</").append(getPropertyName(prop)).append(">");
  }

  protected void outputAttributes(FObject obj) {
    List<PropertyInfo> attributes = getProperties(obj, true);

    for ( PropertyInfo attribute : attributes ) {
      Object value = attribute.get(obj);
      if ( value == null ) continue;

      writer_.append(" ")
        .append(getPropertyName(attribute))
        .append("=\"");
      output(value);
      writer_.append("\"");
    }
  }

  protected String getPropertyName(PropertyInfo prop) {
    return outputShortNames_ && ! SafetyUtil.isEmpty(prop.getShortName()) ?
      prop.getShortName() : prop.getName();
  }

  public Outputter setOutputShortNames(boolean outputShortNames) {
    outputShortNames_ = outputShortNames;
    return this;
  }

  public Outputter setOutputDefaultValues(boolean outputDefaultValues) {
    outputDefaultValues_ = outputDefaultValues;
    return this;
  }

  @Override
  public void close() throws IOException {
    IOUtils.closeQuietly(stringWriter_);
    IOUtils.closeQuietly(writer_);
  }

  @Override
  public void flush() throws IOException {
    if ( stringWriter_ != null ) stringWriter_.flush();
    if ( writer_ != null ) writer_.flush();
  }

  @Override
  public String toString() {
    return ( stringWriter_ != null ) ? stringWriter_.toString() : null;
  }
}
