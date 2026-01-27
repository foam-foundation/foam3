/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import foam.lang.FEnum;
import foam.lib.parse.*;
import foam.core.logger.Logger;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.SignatureException;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.w3c.dom.Document;
import org.w3c.dom.Element;


public abstract class AbstractEnumPropertyInfo
  extends AbstractObjectPropertyInfo
{
  protected static final Parser parser__ = new foam.lib.parse.Alt(foam.lib.json.IntParser.instance(), foam.lib.json.StringParser.instance());

  protected static final ThreadLocal<ByteBuffer> bb = new ThreadLocal<ByteBuffer>() {
    @Override
    protected ByteBuffer initialValue() {
      return ByteBuffer.wrap(new byte[4]);
    }

    @Override
    public ByteBuffer get() {
      ByteBuffer bb = super.get();
      bb.clear();
      return bb;
    }
  };

  public abstract int            getOrdinal(Object o);
  public abstract java.lang.Enum forOrdinal(int ordinal);
  public abstract java.lang.Enum forLabel(String label);
  public abstract void           toJSON(foam.lib.json.Outputter outputter, Object value);

  @Override
  public void copyFromXML(X x, FObject fobj, XMLStreamReader reader) {
    try {
      while ( reader.hasNext() ) {
        switch ( reader.getEventType() ) {
          case XMLStreamConstants.START_ELEMENT:
            // Enum Specific Case
            if ( reader.getLocalName().equals(this.getName()) || reader.getLocalName().equals(this.getShortName()) ) {
              // Move to characters within tags to extract ordinal value
              reader.next();
              String text = reader.getText();
              try {
                set(fobj, this.forOrdinal(Integer.parseInt(text)));
              } catch (NumberFormatException e) {
                set(fobj, this.forLabel(text));
              }
              return;
            }
          case XMLStreamConstants.END_ELEMENT:
            break;
        }
        reader.next();
      }
    } catch (XMLStreamException ex) {
      Logger logger = (Logger) x.get("logger");
      logger.error("Premature end of xml file while reading property", this.getName());
    }
  }

  @Override
  public void updateDigest(FObject obj, MessageDigest md) {
    if ( ! includeInDigest() ) return;
    int val = getOrdinal(get(obj));
    md.update((ByteBuffer) bb.get().putInt(val).flip());
  }

  @Override
  public void updateSignature(FObject obj, Signature sig) throws SignatureException {
    if ( ! includeInSignature() ) return;
    int val = getOrdinal(get(obj));
    sig.update((ByteBuffer) bb.get().putInt(val).flip());
  }

  public void format(foam.lib.formatter.FObjectFormatter formatter, foam.lang.FObject obj) {
    formatter.outputEnum((FEnum) get_(obj));
  }

  public Parser jsonParser() { return parser__; }

  public Parser csvParser() { return parser__; }
}
