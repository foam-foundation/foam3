/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import foam.core.logger.Logger;
import java.util.Collections;
import java.util.Map;
import java.lang.reflect.Modifier;
import java.lang.reflect.Method;
import java.util.concurrent.ConcurrentHashMap;


public class SimpleFacetManager
  implements FacetManager
{
  public SimpleFacetManager() {
  }

  public Object getInstanceOf(Object value, Class type, X x) {
    return create(type, x);
  }

  public <T> T create(Class<T> type, X x) {
    return create(type, Collections.<String, Object>emptyMap(), x);
  }

  public <T> T create(Class<T> type, Map<String, Object> args, X x) {
    if ( type == foam.lang.FObject.class ) {
      throw new RuntimeException("Unable to create FObject");
    }

    try {
      // Automatically load FooImpl if Foo is abstract.
      // KGR: Why/where do we do this?
      // KGR: I Think this is wrong. If Foo is Abstract it should be called AbstractFoos
      if ( java.lang.reflect.Modifier.isAbstract(type.getModifiers()) ) {
        try {
          type = (Class<T>) Class.forName(type.getName() + "Impl");
        } catch (ClassNotFoundException e) {
          // NOP
        }
      }

      T obj = null;
      try {
        java.lang.reflect.Method method = type.getMethod("getOwnClassInfo");
        ClassInfo classInfo = (ClassInfo) method.invoke(null);

        // First check the context for a custom factory for this type of object.
        // If there's nothing in the context, check the ClassInfo for an axiom
        // that creates instances of this type of object. Singletons and
        // multitons are common examples of this type of axiom.
        Object f = null;
        if ( x.get(classInfo.getId() + "_Factory") != null ) {
          f = x.get(classInfo.getId() + "_Factory");
        } else if ( classInfo.getAxiomsByClass(XArgsFactory.class).size() == 1 ) {
          f = classInfo.getAxiomsByClass(XArgsFactory.class).get(0);
        }

        if ( f != null ) {
          obj = ((XArgsFactory<T>) f).getInstance(args, x);
        }
      } catch (NoSuchMethodException e) {
        // nop
      } catch (NullPointerException e) {
        ((Logger) x.get("logger")).error(this.getClass().getSimpleName(), "Unable to create " + type.getName());
        throw e;
      }

      if ( obj == null ) {
        obj = type.newInstance();
      }

      if ( obj instanceof ContextAware ) ((ContextAware) obj).setX(x);

      if ( obj instanceof FObject ) {
        for ( Map.Entry<String, Object> entry : args.entrySet() )
          ((FObject) obj).setProperty(entry.getKey(), entry.getValue());
      }

      return obj;
    } catch (Throwable e) {
      throw new RuntimeException(e);
    }
  }

  public Object create(String clsName, X x) {
    return create(clsName, Collections.<String, Object>emptyMap(), x);
  }

  public Object create(String clsName, Map<String, Object> args, X x) {
    if ( clsName.equals("foam.lang.FObject") ) {
      throw new RuntimeException("Unable to create FObject");
    }

    try {
      Object obj;
      try {
        Object f = x.get(clsName + "_Factory");
        // System.err.println("********************************************** CREATED " + clsName);
        obj = ((XArgsFactory<?>) f).getInstance(args, x);
      } catch (NullPointerException e) {
        ((Logger) x.get("logger")).error(this.getClass().getSimpleName(), "Unable to create " + clsName);
        throw e;
      }

      if ( obj instanceof ContextAware ) ((ContextAware) obj).setX(x);

      if ( obj instanceof FObject ) {
        for ( Map.Entry<String, Object> entry : args.entrySet() )
          ((FObject) obj).setProperty(entry.getKey(), entry.getValue());
      }

      return obj;
    } catch (Throwable e) {
      throw new RuntimeException(e);
    }
  }

  protected final ConcurrentHashMap<String, ClassInfo> classInfos_ = new ConcurrentHashMap<String, ClassInfo>();

  public static ClassInfo getClassInfo(Class cls) {
    if ( cls == null ) return null;

    try {
      Method method = cls.getMethod("getOwnClassInfo");

      return (ClassInfo) method.invoke(null);
    } catch (Throwable t) {
      return null;
    }
  }

  public ClassInfo getClassInfo(String clsName, X x) {
    ClassInfo ci = classInfos_.get(clsName);

    // TODO: cache negative matches?
    if ( ci == null ) {
      try {
        Class cls = null;

        try {
          cls = Class.forName(clsName);
        } catch (ClassNotFoundException e) {
          // Maybe it's an inner-class, which replace the last . with a $ in Java

          int i = clsName.lastIndexOf('.');
          if ( i != -1 ) {
            StringBuilder sb = new StringBuilder(clsName);
            sb.setCharAt(i, '$');
            clsName = sb.toString();
            cls = Class.forName(clsName);
          }
        }

        if ( cls != null ) return getClassInfo(cls);
      } catch (Throwable t) {
        return null;
      }

      classInfos_.put(clsName, ci);
    }

    return ci;
  }
}
