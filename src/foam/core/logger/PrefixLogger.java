/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.logger;

public class PrefixLogger
  extends ProxyLogger
{

  protected Object[] prefix_;

  public PrefixLogger(Object[] prefix, Logger delegate) {
    prefix_ = prefix;
    setDelegate(delegate);
  }

  protected Object[] prefix(Object[] args) {
    if ( prefix_ == null ) return args;

    Object[] ret = new Object[prefix_.length + args.length];

    System.arraycopy(prefix_, 0, ret, 0, prefix_.length);
    System.arraycopy(args, 0, ret, prefix_.length, args.length);

    return ret;
  }
  
  // A null delegate must never turn a logged message into an NPE that masks
  // back to StdoutLogger so the message still lands somewhere instead of throwing.
  protected Logger delegate() {
    Logger d = getDelegate();
    return d != null ? d : StdoutLogger.instance();
  }

  public void log(Object... args) {
    delegate().log(prefix(args));
  }

  public void info(Object... args) {
    delegate().info(prefix(args));
  }

  public void warning(Object... args) {
    delegate().warning(prefix(args));
  }

  public void error(Object... args) {
    delegate().error(prefix(args));
  }

  public void debug(Object...  args) {
    delegate().debug(prefix(args));
  }
}