/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'FileCrawler',
  extends: 'foam.core.ai.dataset.AbstractFileCrawler',

  documentation: `
    Client-side companion for the handwritten FileCrawler.java.

    AbstractFileCrawler is declared with flags: 'js|java', so it is registered
    in both the JS and Java class registries. The concrete implementation lives
    in a pure Java file (FileCrawler.java) under javaFiles, which compiles it
    for the server but produces no JS. Without this companion the browser cannot
    deserialize an FObjectProperty whose runtime type is FileCrawler — the JSON
    parser calls foam.lookup('foam.core.ai.dataset.FileCrawler') and gets null,
    and the property silently becomes null on the client.

    This file registers the class name in the JS registry so the browser can
    round-trip instances through jobDAO. See doc/guides/WritingJavaCode.md.
  `
});
