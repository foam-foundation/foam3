/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'dataset',
  files: [
    { name: 'AlpacaSample',    flags: 'js|java' },
    { name: 'DataCrawler',     flags: 'js|java' },
    { name: 'AbstractFileCrawler',    flags: 'js|java' },
    { name: 'AbstractDatasetGenerator', flags: 'js|java' },
    { name: 'FileCrawler',                    flags: 'js' },
    { name: 'AlpacaSampleDedupeRuleAction',   flags: 'js|java' }
  ],
  javaFiles: [
    { name: 'FileCrawler' }
  ]
});
