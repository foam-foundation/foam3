/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.fs.test',
  name: 'RecordingWatcher',
  extends: 'foam.core.fs.Watcher',

  documentation: 'Test double for Watcher: records handled requests, rejects names starting with "skip".',

  javaImports: [
    'java.util.concurrent.CopyOnWriteArrayList'
  ],

  properties: [
    {
      class: 'Object',
      name: 'handled',
      javaType: 'java.util.List<String>',
      javaFactory: 'return new CopyOnWriteArrayList<>();'
    }
  ],

  methods: [
    {
      name: 'acceptRequest',
      javaCode: 'return ! request.startsWith("skip");'
    },
    {
      name: 'handleRequest',
      javaCode: 'getHandled().add(request);'
    }
  ]
});
