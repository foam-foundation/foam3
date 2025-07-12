/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.formatter;

import foam.lang.ClassInfo;
import foam.lang.FObject;
import foam.lang.PropertyInfo;
import foam.lang.X;
import foam.lib.PropertyPredicate;
import foam.lib.StorageOptionalPropertyPredicate;
import java.util.*;

public abstract class AbstractFObjectFormatter
  implements FObjectFormatter
{

  protected X             x_;
  protected StringBuilder b_ = new StringBuilder();

  // Used to filter properties that are being outputted.
  protected PropertyPredicate propertyPredicate_;

  // additional predicate applied to determine if the property is 'storageOptional'. If after processing an object, if only storageOptional properties remain, then the object is not output.
  protected PropertyPredicate optionalPredicate_         = new StorageOptionalPropertyPredicate();
  protected Map<String, List<PropertyInfo>> propertyMap_ = new HashMap<>();

  public AbstractFObjectFormatter(X x) {
    setX(x);
  }

  public AbstractFObjectFormatter() { }

  public void setX(X x) {
    x_ = x;
    // Could be a different user, so need to clear the old propertyMap
    propertyMap_.clear();
  }

  public X getX() {
    return x_;
  }

  public StringBuilder builder() { return b_; }

  // single point of access to b_ to simplify subclassing.
  public StringBuilder append(Object o) {
    b_.append(o);
    return b_;
  }

  public void reset() {
    builder().setLength(0);
  }


  public void output(float val, int precision) {
    output(val);
  }

  public void output(double val, int precision) {
    output(val);
  }

  public String stringify(FObject obj) {
    reset();
    output(obj);
    return b_.toString();
  }

  public String stringifyDelta(FObject oldFObject, FObject newFObject) {
    reset();
    maybeOutputDelta(oldFObject, newFObject);
    return b_.toString();
  }

  public boolean maybeOutputDelta(FObject oldFObject, FObject newFObject) {
    return maybeOutputDelta(oldFObject, newFObject, null, null);
  }

  public int compare(PropertyInfo prop, FObject oldFObject, FObject newFObject) {
    return prop.compare(oldFObject, newFObject);
  }

  protected synchronized List getProperties(PropertyInfo parentProp, ClassInfo info) {
    String of = info.getName();

    if ( ! propertyMap_.containsKey(of) ) {
      List<PropertyInfo> filteredAxioms = new ArrayList<>();
      Iterator e = info.getAxiomsByClass(PropertyInfo.class).iterator();
      while ( e.hasNext() ) {
        PropertyInfo prop = (PropertyInfo) e.next();
        if ( propertyPredicate_ == null || propertyPredicate_.propertyPredicateCheck(this.x_, of, prop) ) {
          filteredAxioms.add(prop);
        }
      }
      propertyMap_.put(of, filteredAxioms);
      return filteredAxioms;
    }

    return propertyMap_.get(of);
  }

  public void setPropertyPredicate(PropertyPredicate p) {
    propertyPredicate_ = p;
    propertyMap_.clear();
  }

  public String toString() {
    return b_.toString();
  }

}
