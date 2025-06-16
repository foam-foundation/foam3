/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.reflow',
  name: 'FlowAccess',

  values: [
    { name: 'PRIVATE',    label: 'Private' },
    { name: 'PUBLIC_RO',  label: 'Read Only' },
    { name: 'PUBLIC_RW',  label: 'Read Write' },
    { name: 'SHARED',     label: 'Share to users and roles' }
  ]
});
