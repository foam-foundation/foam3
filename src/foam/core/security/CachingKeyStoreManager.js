/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.security',
  name: 'CachingKeyStoreManager',
  extends: 'foam.core.security.ProxyKeyStoreManager',

  implements: ['foam.core.COREService'],

  javaImports: [
    'foam.core.COREService',
    'java.util.Map',
    'java.util.concurrent.ConcurrentHashMap'
  ],

  javaCode: `
    protected volatile Map<String, String> cache_;
  `,

  methods: [
    {
      name: 'start',
      javaThrows: [ 'java.lang.Exception' ],
      javaCode: `
        cache_ = new ConcurrentHashMap<>();
        if ( getDelegate() instanceof COREService service ) {
          service.start();
        }
      `
    },
    {
      name: 'reload',
      javaCode: `
        cache_ = new ConcurrentHashMap<>();
        if ( getDelegate() instanceof COREService service ) {
          service.reload();
        }
      `
    },
    {
      name: 'getSecret',
      javaCode: `
        if ( ! cache_.containsKey(alias) ) {
          String secret = getDelegate().getSecret(x, alias);
          cache_.put(alias, secret);
        }
        return cache_.get(alias);
      `
    }
  ]
});
