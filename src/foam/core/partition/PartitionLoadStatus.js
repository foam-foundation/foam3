/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.partition',
  name: 'PartitionLoadStatus',

  documentation: `Ephemeral status row for one in-progress partition journal
    load. id is the full journal name (unique per partition file). Rows live
    only in memory; a row exists exactly while its load is running.`,

  properties: [
    {
      class: 'String',
      name: 'id',
      documentation: 'Full journal name of the loading partition file.'
    },
    {
      class: 'String',
      name: 'serviceName',
      documentation: 'CSpec name (or EasyDAO name for dynamic DAOs) clients match against.'
    },
    {
      class: 'String',
      name: 'partition',
      documentation: 'Display partition value, e.g. 2026/7. Empty for non-partitioned unloadable DAOs.'
    },
    { class: 'Long', name: 'totalBytes' },
    { class: 'Long', name: 'bytesRead' },
    { class: 'DateTimeUTC', name: 'startTime' },
    {
      class: 'Boolean',
      name: 'queued',
      documentation: 'True while the row is a placeholder for a partition that will load but whose replay has not started yet.'
    }
  ]
});
