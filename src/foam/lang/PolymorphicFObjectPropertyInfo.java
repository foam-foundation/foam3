/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import javax.xml.stream.XMLStreamReader;

/**
 * FObject property info that instantiates objects from the XML element's
 * class="..." attribute (instead of using a fixed 'of()' default class).
 *
 * This is useful for polymorphic command payloads where the model must specify
 * the concrete class.
 */
public abstract class PolymorphicFObjectPropertyInfo
  extends AbstractFObjectPropertyInfo
{
  @Override
  public void copyFromXML(X x, FObject fobj, XMLStreamReader reader) {
    // Reader is positioned on the START_ELEMENT for this property.
    // Use the element's class="..." attribute to pick the concrete class.
    FObject obj = XMLSupport.createObj(x, reader, null);
    set(fobj, obj);
  }
}
