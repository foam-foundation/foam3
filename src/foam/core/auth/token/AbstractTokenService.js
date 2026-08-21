/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth.token',
  name: 'AbstractTokenService',
  abstract: true,

  documentation: 'Abstract implementation of Token Service',

  implements: [
    'foam.core.auth.token.TokenService'
  ],

  javaImports: [
    'foam.dao.DAO',
    'foam.core.auth.token.Token',
    'java.util.Date',
    'static foam.mlang.MLang.*'
  ],

  properties: [
    {
      class: 'Duration',
      name: 'ttl',
      units: 'ms',
      documentation: 'The "time to live" of the token.',
      value: 28800000 // 8 hours
    }
  ],

  methods: [
    {
      name: 'generateExpiryDate',
      type: 'Date',
      javaCode: 'return new Date(new Date().getTime() + getTtl());'
    },
    {
      name: 'generateToken',
      javaCode: `return this.generateTokenWithParameters(x, user, null);`
    },
    {
      name: 'validateToken',
      javaCode: `
        DAO tokenDAO = (DAO) x.get("localTokenDAO");
        Token tokenResult = (Token) tokenDAO.find(EQ(Token.DATA, token));
        if ( tokenResult == null ) throw new RuntimeException("INVALID_TOKEN");
        if ( tokenResult.getProcessed() ) throw new RuntimeException("TOKEN_ALREADY_USED");
        if ( tokenResult.getExpiry().before(new Date()) ) throw new RuntimeException("TOKEN_EXPIRED");
      `
    }
  ]
});
