/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.config;

import foam.dao.DAO;
import foam.lang.X;
import java.util.Date;

/**
 * Lookup helpers for GlobalConfig. Each typed getter takes an X context,
 * an entry name, and a default value returned when the entry is missing,
 * the DAO is not registered, or the entry's type does not match.
 */
public final class GlobalConfigs {
  private GlobalConfigs() {}

  public static Object get(X x, String name) {
    GlobalConfig cfg = find_(x, name);
    return cfg == null ? null : cfg.getValue();
  }

  public static String getString(X x, String name, String defaultValue) {
    GlobalConfig cfg = find_(x, name);
    return matches_(cfg, GlobalConfigType.STRING) ? cfg.getStringValue() : defaultValue;
  }

  public static boolean getBoolean(X x, String name, boolean defaultValue) {
    GlobalConfig cfg = find_(x, name);
    return matches_(cfg, GlobalConfigType.BOOLEAN) ? cfg.getBooleanValue() : defaultValue;
  }

  public static int getInt(X x, String name, int defaultValue) {
    GlobalConfig cfg = find_(x, name);
    return matches_(cfg, GlobalConfigType.INT) ? cfg.getIntValue() : defaultValue;
  }

  public static long getLong(X x, String name, long defaultValue) {
    GlobalConfig cfg = find_(x, name);
    return matches_(cfg, GlobalConfigType.LONG) ? cfg.getLongValue() : defaultValue;
  }

  public static float getFloat(X x, String name, float defaultValue) {
    GlobalConfig cfg = find_(x, name);
    return matches_(cfg, GlobalConfigType.FLOAT) ? cfg.getFloatValue() : defaultValue;
  }

  public static double getDouble(X x, String name, double defaultValue) {
    GlobalConfig cfg = find_(x, name);
    return matches_(cfg, GlobalConfigType.DOUBLE) ? cfg.getDoubleValue() : defaultValue;
  }

  public static Date getDate(X x, String name, Date defaultValue) {
    GlobalConfig cfg = find_(x, name);
    return matches_(cfg, GlobalConfigType.DATE) ? cfg.getDateValue() : defaultValue;
  }

  public static Date getDateTime(X x, String name, Date defaultValue) {
    GlobalConfig cfg = find_(x, name);
    return matches_(cfg, GlobalConfigType.DATE_TIME) ? cfg.getDateTimeValue() : defaultValue;
  }

  private static GlobalConfig find_(X x, String name) {
    if ( x == null || name == null ) return null;
    DAO dao = (DAO) x.get("globalConfigDAO");
    if ( dao == null ) return null;
    return (GlobalConfig) dao.find(name);
  }

  private static boolean matches_(GlobalConfig cfg, GlobalConfigType type) {
    return cfg != null && cfg.getType() == type;
  }
}
