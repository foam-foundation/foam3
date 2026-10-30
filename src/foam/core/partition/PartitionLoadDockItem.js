/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionLoadDockItem',

  implements: [ 'foam.u2.dock.DockItem' ],

  documentation: `One service's partition load as a Dock card. The
    PartitionLoadWatcher creates it when the service's first status row
    appears, keeps progress and statusMsg current on every poll, and undocks
    it when the load finishes.`,

  properties: [
    [ 'running',      true ],
    [ 'showProgress', true ]
  ],

  methods: [
    function open() {}
  ]
});
