/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import java.util.List;

/** Provides runtime information about a Class. **/
// KGR: Why is this mutable?
public interface ClassInfo
  extends Comparable
{
  String      getId();
  ClassInfo   setId(String id);

  String      getPlural();

  ClassInfo   getParent();
  ClassInfo   addAxiom(Axiom a);

  boolean     isInstance(Object o);
  // TODO: should return FObject
  Object      newInstance() throws IllegalAccessException, InstantiationException;

  boolean     isAssignableFrom(Class cls);

  default
  boolean     isAssignableTo(Class cls) { return cls.isAssignableFrom(getObjClass()); }

  String      getName();

  String      getSimpleName();

  ClassInfo   setObjClass(Class cls);
  Class       getObjClass();

  List        getAxioms();
  Object      getAxiomByName(String name);
  Object      getAxiomByNameOrShortName(String name);
  <T> List<T> getAxiomsByClass(Class<T> cls);
}
