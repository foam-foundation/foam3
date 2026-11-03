/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector.provider',
  name: 'OpenAIEmbeddingService',
  label: 'OpenAI',
  abstract: true,
  implements: ['foam.ai.vector.EmbeddingService'],

  properties: [
    {
      class: 'String',
      name: 'endpoint',
      value: 'https://api.openai.com/v1/embeddings'
    },
    {
      class: 'String',
      name: 'model',
      value: 'text-embedding-3-small'
    },
    {
      class: 'String',
      name: 'apiKey',
      hidden: true,
      javaFactory: `
        foam.core.auth.APIKeyCredential cred = (foam.core.auth.APIKeyCredential)
          ((foam.dao.DAO) getX().get("credentialDAO")).find("foam/llm/openai");
        if ( cred == null )
          throw new RuntimeException("Embedding credential not found: foam/llm/openai");
        return cred.getApiKeySecret(getX());
      `
    }
  ],

  methods: [
    async function embed(x, text) {
      return x.openAIEmbeddingService.embed(x, text);
    },

    async function embedAll(x, texts) {
      return x.openAIEmbeddingService.embedAll(x, texts);
    }
  ]
});
