/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.browser',
  name: 'BrowserConfig',

  implements: [
    'foam.core.auth.EnabledAware'
  ],

  documentation: 'Browser specific configuration',

  javaImports: [
    'foam.lang.X',
    'java.nio.file.Files',
    'java.nio.file.FileSystems'
  ],

  properties: [
    {
      name: 'id',
      class: 'String',
      required: true,
      createVisibility: 'RW',
      updateVisibility: 'RO',
      readVisibility: 'RO'
    },
    {
      name: 'type',
      class: 'String',
      required: true,
    },
    {
      name: 'execPaths',
      class: 'StringArray',
      required: true
    },
    {
      name: 'headlessFlags',
      class: 'StringArray'
    },
    {
      name: 'headedFlags',
      class: 'StringArray'
    },
    {
      name: 'dataDir',
      class: 'String',
      documentation: 'Directory for browser user data and cache. If not set, browser defaults to system temp or profile directory.'
    }
  ],

  methods: [
    {
      name: 'getExecutable',
      args: 'X x',
      type: 'String',
      javaCode: `
      for ( String path : getExecPaths() ) {
        if ( Files.exists(FileSystems.getDefault().getPath(path)) ) {
          return path;
        }
      }
      throw new RuntimeException(getType() + " executable not found");
      `
    }
  ]
});
