/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lang;

import foam.dao.jdbc.IndexedPreparedStatement;
import foam.core.auth.AuthService;
import foam.core.auth.AuthorizationException;
import foam.core.logger.Logger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.SignatureException;
import java.sql.SQLException;
import java.util.Map;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

public abstract class AbstractPropertyInfo
  implements PropertyInfo
{
  final static String[] EMPTY_STRING_ARRAY = new String[] {};

  protected ClassInfo parent;
  protected byte[]    nameAsByteArray_ = null;

  @Override
  public PropertyInfo setClassInfo(ClassInfo p) {
    parent = p;
    return this;
  }

  @Override
  public ClassInfo getClassInfo() {
    return parent;
  }

  public String[] getAliases() {
    return EMPTY_STRING_ARRAY;
  }

  @Override
  public void toJSON(foam.lib.json.Outputter outputter, Object value) {
    outputter.output(value);
  }

  @Override
  public foam.mlang.Expr partialEval() {
    return this;
  }

  @Override
  public void prepareStatement(IndexedPreparedStatement stmt) throws SQLException {
    /* Template Method: override in subclasses if required. */
  }

  @Override
  public Object f(Object o) {
    return get(o);
  }

  public boolean equals(Object obj) {
    try {
      return compareTo(obj) == 0;
    } catch (ClassCastException e) {
      return false;
    }
  }

  public int compareTo(Object obj) {
    int result = getName().compareTo(((PropertyInfo) obj).getName());
    return result != 0 ? result : getClassInfo().compareTo(((PropertyInfo) obj).getClassInfo());
  }

  public String createStatement() {
    return getName();
  }

  @Override
  public void setStatementValue(IndexedPreparedStatement stmt, FObject o) throws java.sql.SQLException {
    stmt.setObject(this.get(o));
  }

  @Override
  public void setFromResultSet(java.sql.ResultSet resultSet, int index, FObject o) throws java.sql.SQLException{
    this.set(o, resultSet.getObject(index));
  }

  @Override
  public boolean includeInDigest() {
    if ( getStorageTransient() || getClusterTransient() )
      return false;

    return true;
  }

  @Override
  public void updateDigest(FObject obj, MessageDigest md) {
    /* Template Method: override in subclasses if required. */
  }

  @Override
  public boolean includeInSignature() {
    return includeInDigest();
  }

  @Override
  public void authorize(X x) {
    // Since MLangs don't write values, we only need to check if the property
    // requires a read permission here.
    if ( this.getReadPermissionRequired() ) {
      AuthService auth       = (AuthService) x.get("auth");
      String simpleName      = this.getClassInfo().getSimpleName();
      String simpleNameLower = simpleName.toLowerCase();
      String nameLower       = this.getName().toLowerCase();

      if ( ! auth.check(x, simpleNameLower + ".ro." + nameLower) && ! auth.check(x, simpleNameLower + ".rw." + nameLower)) {
        throw new AuthorizationException(String.format("Access denied. User lacks permission to access property '%s' on model '%s'.", this.getName(), simpleName));
      }
    }
  }

  @Override
  public void updateSignature(FObject obj, Signature sig)
    throws SignatureException
  {
    /* Template Method: override in subclasses if required. */
  }

  @Override
  public byte[] getNameAsByteArray() {
    if ( nameAsByteArray_ == null ) {
      nameAsByteArray_ = getName().getBytes(StandardCharsets.UTF_8);
    }

    return nameAsByteArray_;
  }

  public void fromCSVLabelMapping(java.util.Map<String, foam.lib.csv.FromCSVSetter> map) {

    foam.lang.PropertyInfo prop = this;
    map.put(getName(), new foam.lib.csv.FromCSVSetter() {
      public void set(foam.lang.FObject obj, String str) {
        prop.set(obj, fromString(str));
      }
    });
  }
}
