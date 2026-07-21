/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.logger;

public class PostfixLogger
  extends ProxyLogger
{

  protected Object[] postfix_;

  public PostfixLogger(Object[] postfix, Logger delegate) {
    postfix_ = postfix;
    setDelegate(delegate);
  }

  protected Object[] postfix(Object[] args) {
    if ( postfix_ == null ) return args;

    Object[] ret = new Object[postfix_.length + args.length];

    System.arraycopy(args, 0, ret, 0, args.length);
    System.arraycopy(postfix_, 0, ret, args.length, postfix_.length);

    return ret;
  }

  // A null delegate must never turn a logged message into an NPE that masks
  // back to StdoutLogger so the message still lands somewhere instead of throwing.
  protected Logger delegate() {
    Logger d = getDelegate();
    return d != null ? d : StdoutLogger.instance();
  }

  public void log(Object... args) {
    delegate().log(postfix(args));
  }

  public void info(Object... args) {
    delegate().info(postfix(args));
  }

  public void warning(Object... args) {
    delegate().warning(postfix(args));
  }

  public void error(Object... args) {
    delegate().error(postfix(args));
  }

  public void debug(Object...  args) {
    delegate().debug(postfix(args));
  }
}
