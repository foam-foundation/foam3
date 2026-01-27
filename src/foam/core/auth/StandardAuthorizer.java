/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.auth;

import foam.lang.FObject;
import foam.lang.X;
import foam.core.auth.AuthService;
import foam.core.auth.AuthorizationException;
import foam.mlang.predicate.Predicate;

public class StandardAuthorizer
  implements Authorizer
{

  protected final static AuthorizationException ACCESS_DENIED = new AuthorizationException("Permission denied.", (Throwable) null, false, false);

  // Standard authorizer to be used for authorization on object not implementing the authorizable interface
  // Performs authorization by checking permission generated from permissionPrefix passed in

  protected static final boolean DEBUG = Boolean.getBoolean("foam.core.auth.debug");

  protected final String permissionPrefix_;
  protected final String createPermission_;
  protected final String globalReadPermission_;
  protected final String globalRemovePermission_;

  public StandardAuthorizer(String permissionPrefix) {
    permissionPrefix_       = permissionPrefix;
    createPermission_       = createPermission("create");
    globalReadPermission_   = createPermission("read", "*");
    globalRemovePermission_ = createPermission("remove", "*");
 }

  public String createPermission(String op) {
    return permissionPrefix_ + "." + op;
  }

  public String createPermission(String op, Object id) {
    return permissionPrefix_ + "." + op + "." + id;
  }

  protected void check(X x, String p) throws AuthorizationException {
    AuthService authService = (AuthService) x.get("auth");

    if ( ! authService.check(x, p) ) {
      // Too slow for such a common operation, only enable when debugging.
      if ( DEBUG ) {
        ((foam.core.logger.Logger) x.get("logger"))
          .debug("StandardAuthorizer", "Permission denied.", p);
      }
      throw new AuthorizationException();
    }
  }

  public void authorizeOnCreate(X x, FObject obj) throws AuthorizationException {
    check(x, createPermission_);
  }

  public void authorizeOnRead(X x, FObject obj) throws AuthorizationException {
    check(x, createPermission("read", obj.getProperty("id")));
  }

  public void authorizeOnUpdate(X x, FObject oldObj, FObject obj) throws AuthorizationException {
    check(x, createPermission("update", obj.getProperty("id")));
  }

  public void authorizeOnDelete(X x, FObject obj) throws AuthorizationException {
    check(x, createPermission("remove", obj.getProperty("id")));
  }

  public boolean checkGlobalRead(X x, Predicate predicate) {
    AuthService authService = (AuthService) x.get("auth");

    try {
      return authService.check(x, globalReadPermission_);
    } catch (AuthorizationException e) {
      return false;
    }
  }

  public boolean checkGlobalRemove(X x) {
    AuthService authService = (AuthService) x.get("auth");

    try {
      return authService.check(x, globalRemovePermission_);
    } catch ( AuthorizationException e ) {
      return false;
    }
  }
}
