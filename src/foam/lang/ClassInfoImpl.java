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
  protected List      axioms;
  protected String    id;
  protected HashMap   axiomsByName_            = new HashMap();
  protected HashMap   axiomsByNameOrShortName_ = null;
  protected ClassInfo parent_                  = null;
  protected List      allAxioms_               = null;
  protected HashMap   axiomMap_                = new HashMap();
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
      ((PropertyInfo)a).setClassInfo(this);
    } else if ( a instanceof MethodInfo ) {
      ((MethodInfo)a).setClassInfo(this);
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
