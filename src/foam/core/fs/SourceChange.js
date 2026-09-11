/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs',
  name: 'SourceChange',

  documentation: `A .js file under core.webroot whose mtime changed. id is the
    webroot-relative path with a leading slash, which is also the URL pathname
    the browser loaded the file from, so foam.u2.ViewReloader matches it against
    Model.source without a lookup table.`,

  properties: [
    { class: 'String',   name: 'id' },
    { class: 'DateTime', name: 'modified', documentation: 'When the change was detected.' }
  ]
});
