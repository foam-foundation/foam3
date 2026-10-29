/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'AbstractFileCrawler',
  abstract: true,
  implements: ['foam.core.ai.dataset.DataCrawler'],

  documentation: 'DataCrawler that walks local directory trees and reads files.',

  properties: [
    {
      class: 'StringArray',
      name: 'sourcePaths',
      documentation: 'Root directories to walk recursively.',
      required: true
    },
    {
      class: 'StringArray',
      name: 'fileExtensions',
      documentation: 'File extensions to include.',
      factory:     function() { return ['.js', '.java', '.md']; },
      javaFactory: `return new String[] { ".js", ".java", ".md" };`
    },
    {
      class: 'Int',
      name: 'maxFiles',
      documentation: 'Stop after this many files. 0 = unlimited.',
      value: 0
    },
    {
      class: 'Long',
      name: 'maxFileSize',
      documentation: 'Skip files larger than this many bytes. 0 = unlimited.',
      value: 0
    }
  ]
});
