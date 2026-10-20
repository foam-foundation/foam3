/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.core.ai.dataset',
  name: 'DataCrawler',

  documentation: `
    Source abstraction for dataset generation.
    collect() returns an ordered list of item ids (file paths, URLs, DAO keys, etc.).
    fetch() returns the raw text content for one item.
  `,

  methods: [
    {
      name: 'collect',
      type: 'List',
      args: 'Context x',
      documentation: 'Return the ordered list of item ids to process.'
    },
    {
      name: 'fetch',
      type: 'String',
      args: 'Context x, String item',
      documentation: 'Return raw text content for a single item id. Return null to skip.'
    }
  ]
});
