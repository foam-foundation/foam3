/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.util;

/** The last phase: the JVM string table, String.intern(). */
public final class JvmInterner implements Interner {

  public static final JvmInterner INSTANCE = new JvmInterner();

  private JvmInterner() {}

  public String intern(String s) { return s == null ? null : s.intern(); }
}
