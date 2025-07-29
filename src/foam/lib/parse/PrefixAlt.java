/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.parse;


public interface PrefixAlt
  extends Parser
{
  PrefixAlt add(String prefix, Parser p);

  void select(java.util.List l);

  PrefixAlt rebalance();
}
