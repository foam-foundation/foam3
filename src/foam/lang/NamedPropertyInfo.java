/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

/**
 * A PropertyInfo that wraps a property NAME and resolves the target axiom
 * lazily from each object's own ClassInfo on every access. Lets a consumer
 * (e.g. FSMDAO) operate uniformly over a class hierarchy where the named
 * property is declared on subclasses rather than the declared base type —
 * without the consumer or the subclass knowing about each other.
 *
 * This wrapper holds NO class reference. `getName()` returns the wrapped
 * name; equality/comparison are name-based (the wrapper's own ClassInfo
 * is intentionally null, so the parent class's classInfo-based compareTo
 * would NPE).
 */
public class NamedPropertyInfo
  extends AbstractObjectPropertyInfo
{
  protected final String name_;

  protected NamedPropertyInfo(String name) {
    this.name_ = name;
  }

  public static PropertyInfo forName(String name) {
    return new NamedPropertyInfo(name);
  }

  protected PropertyInfo resolveTarget(Object obj) {
    if ( ! ( obj instanceof FObject ) ) return null;
    ClassInfo info = ((FObject) obj).getClassInfo();
    if ( info == null ) return null;
    Object axiom = info.getAxiomByName(name_);
    return axiom instanceof PropertyInfo ? (PropertyInfo) axiom : null;
  }

  @Override
  public String getName() {
    return name_;
  }

  @Override
  public Object get(Object obj) {
    PropertyInfo target = resolveTarget(obj);
    return target == null ? null : target.get(obj);
  }

  @Override
  public void set(Object obj, Object value) {
    PropertyInfo target = resolveTarget(obj);
    if ( target != null ) target.set(obj, value);
  }

  @Override
  public void clear(Object obj) {
    PropertyInfo target = resolveTarget(obj);
    if ( target != null ) target.clear(obj);
  }

  @Override
  protected Object get_(Object obj) {
    return get(obj);
  }

  @Override
  public boolean isSet(Object obj) {
    PropertyInfo target = resolveTarget(obj);
    return target != null && target.isSet(obj);
  }

  @Override
  public foam.lib.parse.Parser jsonParser() {
    return null;
  }

  @Override
  public boolean containsPII() {
    return false;
  }

  @Override
  public boolean containsDeletablePII() {
    return false;
  }

  @Override
  public int compareTo(Object obj) {
    if ( ! ( obj instanceof PropertyInfo ) ) return -1;
    return getName().compareTo(((PropertyInfo) obj).getName());
  }

  @Override
  public boolean equals(Object obj) {
    if ( ! ( obj instanceof PropertyInfo ) ) return false;
    return getName().equals(((PropertyInfo) obj).getName());
  }

  @Override
  public int hashCode() {
    return getName().hashCode();
  }
}
