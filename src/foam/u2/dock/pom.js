/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'dock',
  projects: [
    { name: 'test/pom', flags: 'test' }
  ],
  files: [
    { name: 'DockItem', flags: 'js' },
    { name: 'Dock',     flags: 'js' }
  ]
});
