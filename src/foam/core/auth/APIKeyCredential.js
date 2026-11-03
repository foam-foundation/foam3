/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'APIKeyCredential',
  extends: 'foam.core.auth.Credential',

  documentation: `
    Credential for services that authenticate with a single API key.
    Applicable to LLM providers (Claude, OpenAI, DeepSeek) and vector/embedding
    providers. The apiKey field holds either a literal key or a vault alias —
    resolved at runtime via getApiKeySecret(x).
  `,

  properties: [
    {
      class: 'String',
      name: 'apiKey',
      includeInDigest: true
    }
  ],

  methods: [
    {
      name: 'getApiKeySecret',
      type: 'String',
      args: 'Context x',
      javaCode: 'return resolveSecret(x, getApiKey());'
    }
  ]
});
