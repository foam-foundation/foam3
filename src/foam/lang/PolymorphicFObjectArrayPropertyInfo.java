/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 */

package foam.lang;

import javax.xml.stream.XMLStreamReader;

/**
 * FObject array property info that instantiates objects from each XML element's
 * class="..." attribute (instead of using a fixed 'of()' class).
 *
 * This is useful for arrays of interface/base types (eg. Predicate[]) where the
 * concrete class must be specified in the XML.
 */
public abstract class PolymorphicFObjectArrayPropertyInfo
  extends AbstractFObjectArrayPropertyInfo
{
  @Override
  public void copyFromXML(X x, FObject obj, XMLStreamReader reader) {
    FObject[] oldArr = (FObject[]) get(obj);
    if ( oldArr == null ) oldArr = new FObject[0];

    FObject[] newArr = new FObject[oldArr.length + 1];
    System.arraycopy(oldArr, 0, newArr, 0, oldArr.length);

    // Reader is positioned on the START_ELEMENT for this property.
    // Use the element's class="..." attribute to pick the concrete class.
    FObject o = XMLSupport.createObj(x, reader, null);
    if ( o != null ) {
      newArr[oldArr.length] = o;
      set(obj, newArr);
    }
  }
}
