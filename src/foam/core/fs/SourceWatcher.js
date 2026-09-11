/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs',
  name: 'SourceWatcher',
  extends: 'foam.core.fs.Watcher',

  documentation: `Reports every changed .js under core.webroot as a SourceChange in sourceChangeDAO, for foam.u2.ViewReloader. Registered by the 'live' deployment journal, which ./build.sh -l adds; a build without it loads neither this service nor the DAO. core.webroot is set for source runs only, so a jar that did load the journal would still log once and return. The source tree is large, so the tree walk runs every 30s and the 500ms tick only stats the known files.`,

  javaImports: [
    'foam.dao.DAO',
    'java.util.Date'
  ],

  properties: [
    {
      name: 'watchDir',
      javaFactory: 'return System.getProperty("core.webroot", "");'
    },
    {
      name: 'recursive',
      value: true
    },
    {
      name: 'skipDirs',
      javaFactory: 'return new String[] { "build", "node_modules", ".git" };'
    },
    {
      name: 'rescanInterval',
      value: 30000
    },
    {
      name: 'initialTimerDelay',
      value: 0
    }
  ],

  methods: [
    {
      name: 'acceptRequest',
      javaCode: 'return request.endsWith(".js");'
    },
    {
      name: 'handleRequest',
      javaCode: `
      ((DAO) x.get("sourceChangeDAO")).inX(x).put(
        new SourceChange.Builder(x)
          .setId("/" + request)
          .setModified(new Date())
          .build());
      `
    },
    {
      name: 'postCleanup',
      javaCode: `
      // the source file stays where it is
      `
    }
  ]
});
