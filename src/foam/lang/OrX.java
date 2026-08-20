/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

/** Simple Or X implementation.
    get - first check delegate, then parent
    put - put to delegate
 **/
public class OrX
  extends ProxyX
{
  /** Store null's as a marker object so that we can distinguish between null and no-binding. **/
  /** Is needed so that inheritance works properly if the child X contains a null binding.    **/
  private static Object NULL = new Object();

  X parent_;

  public OrX() {
    this(EmptyX.instance(), EmptyX.instance());
  }

  public OrX(X x) {
    this(x, EmptyX.instance());
  }

  public OrX(X parent, X delegate) {
    super(delegate);
    parent_ = parent;
  }

  public X put(Object name, Object value) {
    return new OrX(parent_, getX().put(name, value == null ? NULL : value));
  }

  public X putFactory(Object name, XFactory factory) {
    return new OrX(parent_, getX().putFactory(name, factory));
  }

  public <T> T get(Class<T> key) {
    return (T) get(this, key);
  }

  public Object get(Object key) {
    return get(this, key);
  }

  public Object get(X x, Object key) {
    Object o = getX().get(x, key);
    if ( o == null ) return parent_.get(x, key);
    return o == NULL ? null : o;
  }

  public XFactory getFactory(X x, Object key) {
    XFactory o = getX().getFactory(x, key);
    return ( o == null ) ? parent_.getFactory(x, key) : o;
  }

  public int getInt(X x, Object key, int defaultValue) {
    Object o = getX().get(x, key);
    if ( o == null ) o = parent_.get(x, key);
    if ( o == null ) return defaultValue;
    return (int) o;
  }

  public boolean getBoolean(X x, Object key, boolean defaultValue) {
    Object o = getX().get(x, key);
    if ( o == null ) o = parent_.get(x, key);
    if ( o == null ) return defaultValue;
    return (boolean) o;
  }

  public X cd(String path) {
    X o = getX().cd(path);
    if ( o == null ) return parent_.cd(path);
    return o;
  }

  public String toString() {
    return "OrX(" + parent_ + ", " + getX() + ")";
  }
}
