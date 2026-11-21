/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.app',
  name: 'HealthAware',

  properties: [
    // {
    //   class: 'Reference',
    //   of: 'foam.core.app.Health',
    //   name: 'health',
    //   label: 'Pulse Id',
    //   readPermissionRequired: true,
    //   writePermissionRequired: true,
    //   tableCellFormatter: function(value, obj, _) {
    //     if ( value ) 
    //       this.start().add(value.hostname+':'+value.appName).end();
    //   }
    // }
    {
      class: 'String',
      name: 'health',
      label: 'Pulse Id',
      readPermissionRequired: true,
      writePermissionRequired: true
    }
  ]
});
