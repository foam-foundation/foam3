/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.security',
  name: 'EmptyKeyStoreManager',
  implements: [ 'foam.core.security.KeyStoreManager' ],

  methods: [
    { name: 'getKeyStore',  javaCode: 'return null; ' },
    { name: 'unlock',       javaCode: '/* noop */ ' },
    { name: 'loadKey',      javaCode: 'return null; ' },
    { name: 'loadKey_',     javaCode: 'return null; ' },
    { name: 'storeKey',     javaCode: '/* noop */ ' },
    { name: 'storeKey_',    javaCode: '/* noop */ ' },
    { name: 'getSecret',    javaCode: 'return ""; ' }
  ]
});
