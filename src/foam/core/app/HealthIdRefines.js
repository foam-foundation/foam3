/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.app',
  name: 'HealthIdRefines',
  refines: 'foam.core.app.HealthId',

  methods: [
    {
      name: 'toSummary',
      type: 'String',
      code: function() {
        return this.hostname + ':' + this.appName;
      },
      javaCode: `
        return getHostname() + ":" + getAppName();
      `
    }
  ]
});
