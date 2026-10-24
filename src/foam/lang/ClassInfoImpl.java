/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import java.util.*;
import foam.util.SafetyUtil;

public class ClassInfoImpl
  implements ClassInfo
{
  private static final java.util.concurrent.ConcurrentHashMap<Class, ClassInfo> BY_CLASS = new java.util.concurrent.ConcurrentHashMap<>();

  /**
   * Factory for handwritten Java subclasses of FOAM-generated bases.
   * Derives the FOAM class ID directly from the Java class name and caches
   * the result, so getClassInfo() / getOwnClassInfo() become one-liners
   * with no error-prone ID string to maintain:
   *
   *   public FileCrawler()   {}
   *   public FileCrawler(X x) { setX(x); }
   *
   *   {@literal @}Override public ClassInfo getClassInfo()    { return ClassInfoImpl.forClass(getClass()); }
   *   public static       ClassInfo getOwnClassInfo() { return ClassInfoImpl.forClass(FileCrawler.class); }
   */
  public static ClassInfo forClass(Class cls) {
    return BY_CLASS.computeIfAbsent(cls, c ->
      new ClassInfoImpl().setId(c.getName()).setObjClass(c));
  }

  protected List      axioms;
  protected String    id;
  protected HashMap   axiomsByName_                   = new HashMap();
  protected HashMap   axiomsByNameOrShortName_        = null;
  protected HashMap   axiomsByNameOrShortNameOrAlias_ = null;
  protected ClassInfo parent_                         = null;
  protected List      allAxioms_                      = null;
  protected HashMap   axiomMap_                       = new HashMap();
  protected Class     class_;

  public ClassInfoImpl() {
    axioms = new ArrayList();
  }

  public String getId() {
    return id;
  }

  public String getPlural() {
    return getId();
  }

  public ClassInfo setObjClass(Class cls) {
    class_ = cls;
    return this;
  }

  public int compareTo(Object obj) {
    return getId().compareTo(((ClassInfo)obj).getId());
  }

  public boolean isAssignableFrom(Class cls) { return getObjClass().isAssignableFrom(cls); }

  public String getName() { return getObjClass().getName(); }

  public String getSimpleName() { return getObjClass().getSimpleName(); }

  public Class getObjClass() {
    return class_;
  }

  public ClassInfo setId(String id) {
    this.id = id;
    return this;
  }

  public ClassInfo getParent() {
    if ( parent_ == null ) {
      Class c;
      java.lang.reflect.Method m;

      try {
        c = getObjClass().getSuperclass();
        m = c.getMethod("getOwnClassInfo");

        parent_ = (ClassInfo) m.invoke(null);
      } catch (NoSuchMethodException e) {
        parent_ = new EmptyClassInfo();
      } catch (java.lang.Exception e) {
        throw new RuntimeException(e);
      }
    }

    return parent_;
  }


  public ClassInfo addAxiom(Axiom a) {
    // TODO: Should all axioms have setClassInfo? If not, create an interface
    // that has setClassInfo and make PropertyInfo implement it.
    if ( a instanceof PropertyInfo ) {
      ((PropertyInfo) a).setClassInfo(this);
    } else if ( a instanceof MethodInfo ) {
      ((MethodInfo) a).setClassInfo(this);
    }
    axioms.add(a);
    axiomsByName_.put(a.getName(), a);
    return this;
  }

  @Override
  public boolean isInstance(Object o) {
    return class_.isInstance(o);
  }

  @Override
  public Object newInstance() throws IllegalAccessException, InstantiationException {
    return class_.newInstance();
  }

  public List getAxioms() {
    if ( allAxioms_ == null ) {
      allAxioms_ = new ArrayList() {
        HashSet<String> keys = new HashSet<>();

        @Override
        public boolean add(Object o) {
          if ( ! (o instanceof Axiom) ) {
            return super.add(o);
          }
          if ( keys.add(((Axiom) o).getName()) ) {
            return super.add(o);
          }
          return false;
        }

        @Override
        public boolean addAll(Collection c) {
          for ( Object o : c ) {
            add(o);
          }
          return true;
        }
      };

      allAxioms_.addAll(axioms);
      allAxioms_.addAll(getParent().getAxioms());
    }

    return allAxioms_;
  }

  public Object getAxiomByName(String name) {
    Object ret = axiomsByName_.get(name);
    if ( ret == null ) {
      ret = getParent().getAxiomByName(name);
      if ( ret != null ) {
        axiomsByName_.put(name, ret);
      }
    }
    return ret;
  }

  public Object getAxiomByNameOrShortName(String name) {
    if ( axiomsByNameOrShortName_ == null ) {
      axiomsByNameOrShortName_ = new HashMap();

      for ( Object o : axioms ) {
        Axiom a = (Axiom) o;

        axiomsByNameOrShortName_.put(a.getName(), a);

        if ( a instanceof PropertyInfo ) {
          PropertyInfo p = (PropertyInfo) a;
          if ( ! SafetyUtil.isEmpty(p.getShortName()) ) {
            axiomsByNameOrShortName_.put(p.getShortName(), a);
          }
        }
      }
    }

    Object ret = axiomsByNameOrShortName_.get(name);
    if ( ret == null ) {
      ret = getParent().getAxiomByNameOrShortName(name);
    }

    return ret;
  }
  public Object getAxiomByNameOrShortNameOrAlias(String name) {
    if ( axiomsByNameOrShortNameOrAlias_ == null ) {
      axiomsByNameOrShortNameOrAlias_ = new HashMap();

      for ( Object o : axioms ) {
        Axiom a = (Axiom) o;

        axiomsByNameOrShortNameOrAlias_.put(a.getName(), a);

        if ( a instanceof PropertyInfo ) {
          PropertyInfo p = (PropertyInfo) a;
          if ( ! SafetyUtil.isEmpty(p.getShortName()) ) {
            axiomsByNameOrShortNameOrAlias_.put(p.getShortName(), a);
          }
          String[] aliases = p.getAliases();
          if ( aliases != null && aliases.length > 0 ) {
            for ( String alias : aliases ) {
              axiomsByNameOrShortNameOrAlias_.put(alias, a);
            }
          }
        }
      }
    }

    Object ret = axiomsByNameOrShortNameOrAlias_.get(name);
    if ( ret == null ) {
      ret = getParent().getAxiomByNameOrShortNameOrAlias(name);
    }

    return ret;
  }
  public List getAxiomsByClass(final Class cls) {
    if ( axiomMap_.containsKey(cls) ) {
      return (List) axiomMap_.get(cls);
    }

    ArrayList ret = new ArrayList() {
      HashSet<String> keys = new HashSet<>();

      @Override
      public boolean add(Object o) {
        if ( ! cls.isInstance(o) ) {
          return false;
        }
        if ( ! (o instanceof Axiom) ) {
          return super.add(o);
        }
        if ( keys.add(((Axiom) o).getName()) ) {
          return super.add(o);
        }
        return false;
      }

      @Override
      public boolean addAll(Collection c) {
        for ( Object o : c ) {
          add(o);
        }
        return true;
      }
    };

    ret.addAll(axioms);
    ret.addAll(getParent().getAxiomsByClass(cls));
    axiomMap_.put(cls, ret);
    return ret;
  }

  public String toString() {
    return "ClassInfoImpl(" + getId() + ")";
  }
}
