/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.core.config.GlobalConfigs',

  documentation: `Lookup helpers for GlobalConfig. Each typed getter takes an
    X context, an entry name, and a default value returned when the entry is
    missing, the DAO is not registered, or the entry's type does not match.`,

  methods: [
    async function get(x, name) {
      var dao = x && x.globalConfigDAO;
      if ( ! dao || ! name ) return undefined;
      var cfg = await dao.find(name);
      return cfg ? cfg.getValue() : undefined;
    },

    async function getTyped_(x, name, type, defaultValue) {
      var dao = x && x.globalConfigDAO;
      if ( ! dao || ! name ) return defaultValue;
      var cfg = await dao.find(name);
      if ( ! cfg || cfg.type !== type ) return defaultValue;
      return cfg.getValue();
    },

    async function getString(x, name, defaultValue) {
      return this.getTyped_(x, name, foam.core.config.GlobalConfigType.STRING, defaultValue);
    },
    async function getBoolean(x, name, defaultValue) {
      return this.getTyped_(x, name, foam.core.config.GlobalConfigType.BOOLEAN, defaultValue);
    },
    async function getInt(x, name, defaultValue) {
      return this.getTyped_(x, name, foam.core.config.GlobalConfigType.INT, defaultValue);
    },
    async function getLong(x, name, defaultValue) {
      return this.getTyped_(x, name, foam.core.config.GlobalConfigType.LONG, defaultValue);
    },
    async function getFloat(x, name, defaultValue) {
      return this.getTyped_(x, name, foam.core.config.GlobalConfigType.FLOAT, defaultValue);
    },
    async function getDouble(x, name, defaultValue) {
      return this.getTyped_(x, name, foam.core.config.GlobalConfigType.DOUBLE, defaultValue);
    },
    async function getDate(x, name, defaultValue) {
      return this.getTyped_(x, name, foam.core.config.GlobalConfigType.DATE, defaultValue);
    },
    async function getDateTime(x, name, defaultValue) {
      return this.getTyped_(x, name, foam.core.config.GlobalConfigType.DATE_TIME, defaultValue);
    }
  ]
});
