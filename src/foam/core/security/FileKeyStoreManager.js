/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.security',
  name: 'FileKeyStoreManager',
  implements: [
    'foam.core.COREService',
    'foam.core.security.KeyStoreManager'
  ],

  documentation: `Local-dev KeyStoreManager. Resolves string secrets from a plain
    KEY=VALUE file (gitignored). NOT for production — production uses AWSSecretsManager.`,

  javaImports: [
    'foam.core.logger.Loggers',
    'foam.util.SafetyUtil',
    'java.io.BufferedReader',
    'java.io.File',
    'java.io.InputStreamReader',
    'java.io.IOException',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.Paths',
    'java.util.ArrayList',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map'
  ],

  properties: [
    {
      class: 'String',
      name: 'secretsPath',
      documentation: 'Path relative to journals/ to the KEY=VALUE secrets file.',
      value: '../var/dev-secrets.env'
    },
    {
      class: 'Object',
      name: 'secrets',
      documentation: 'Parsed alias -> value map.',
      javaType: 'java.util.Map<String,String>',
      transient: true,
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    {
      name: 'start',
      javaThrows: ['java.lang.Exception'],
      javaCode: `unlock();`
    },
    {
      name: 'reload',
      javaCode: `
        clearProperty("secrets");
        try {
          start();
        } catch ( Exception e ) {
          throw new RuntimeException(e);
        }
      `
    },
    {
      name: 'unlock',
      javaCode: `
        Map<String,String> map = new HashMap<>();
        List<String> lines = null;
        if ( SafetyUtil.isEmpty(getSecretsPath()) ) {
          Loggers.logger(getX(), this).warning("Secrets path empty");
        } else if ( getSecretsPath().startsWith(File.separator) ) {
          // absolute path
          Path secretsPath = Paths.get(getSecretsPath());
          if ( ! secretsPath.toFile().exists() ) {
            Loggers.logger(getX(), this).warning("Secrets file not found", getSecretsPath());
          } else {
            lines = Files.readAllLines(secretsPath);
          }
        } else {
          foam.core.fs.Storage storage = getX().get(foam.core.fs.Storage.class);
          if ( getSecretsPath().startsWith("..") ) {
            // file relative to storage root - journals/
            storage = getX().get(foam.core.fs.FileSystemStorage.class);
          }
          try ( BufferedReader reader = new BufferedReader(new InputStreamReader(storage.getInputStream(getSecretsPath()))) ) {
            lines = new ArrayList();
            String line = null;
            while ( ( line = reader.readLine() ) != null ) {
              lines.add(line.trim());
            }
          } catch (Throwable e) {
            Loggers.logger(getX(), this).warning("Secrets file not found", getSecretsPath(), e.getMessage());
          }
        }
        if ( lines != null ) {
          for ( String line : lines ) {
            if ( line.isEmpty() || line.startsWith("#") ) continue;
            int eq = line.indexOf('=');
            if ( eq <= 0 ) continue;
            String key = line.substring(0, eq).trim();
            String val = line.substring(eq + 1).trim();
            map.put(key, val);
          }
        }
        setSecrets(map);
        Loggers.logger(getX(), this).debug("Secrets loaded", map.size());
      `
    },
    {
      name: 'getSecret',
      javaCode: `
        // Re-read on each call so editing the file is picked up without restart
        unlock();
        String v = getSecrets().get(alias);
        if ( v == null ) {
          Loggers.logger(x, this).warning("getSecret, alias not found", alias);
          throw new IllegalArgumentException("Secret not found: " + alias);
        }
        return v;
      `
    },

    // String-secret vault only: no Java KeyStore operations needed.
    { name: 'getKeyStore', javaCode: `return null;` },
    { name: 'loadKey',     javaCode: `throw new UnsupportedOperationException("loadKey not supported for FileKeyStoreManager");` },
    { name: 'loadKey_',    javaCode: `throw new UnsupportedOperationException("loadKey_ not supported for FileKeyStoreManager");` },
    { name: 'storeKey',    javaCode: `throw new UnsupportedOperationException("storeKey not supported for FileKeyStoreManager");` },
    { name: 'storeKey_',   javaCode: `throw new UnsupportedOperationException("storeKey_ not supported for FileKeyStoreManager");` }
  ]
});
