/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.dao;

import foam.lang.Detachable;
import foam.lang.FObject;
import foam.lang.X;
import foam.core.auth.AuthorizationException;
import foam.core.auth.Authorizer;

public class AuthorizationSink
  extends ProxySink
{
  public Authorizer authorizer_;
  public Boolean    checkDelete_;

  public AuthorizationSink(X x, Authorizer authorizer, Sink delegate) {
    this(x, authorizer, delegate, false);
  }

  public AuthorizationSink(X x, Authorizer authorizer, Sink delegate, Boolean checkDelete) {
    super(x, delegate);
    authorizer_  = authorizer;
    checkDelete_ = checkDelete;
  }

  @Override
  public void put(Object obj, Detachable sub) {
    if ( authorized(obj) ) super.put(obj, sub);
  }

  /**
   * A remove is checked too: a listener also hears removes, and foam3's Java PredicatedListener
   * turns a put that fails its predicate into a remove that carries the whole row.
   */
  @Override
  public void remove(Object obj, Detachable sub) {
    if ( authorized(obj) ) super.remove(obj, sub);
  }

  protected boolean authorized(Object obj) {
    // Only AuthorizationExceptions from authorizeOnRead and authorizeOnDelete are caught here, so one
    // thrown by a sink further down the delegate chain still reaches the caller.
    try {
      if ( checkDelete_ ) {
        authorizer_.authorizeOnDelete(getX(), (FObject) obj);
      } else {
        authorizer_.authorizeOnRead(getX(), (FObject) obj);
      }
      return true;
    } catch ( AuthorizationException e ) {
      return false;
    }
  }
}
