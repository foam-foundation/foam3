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
      documentation: `
        Where embeddings are requested. Unless set on the instance, a url on credential
        foam/llm/openai, host only (e.g. http://host:8001), sends them to an OpenAI-compatible
        endpoint at <url>/v1/embeddings; without one they go to OpenAI. The url is read on
        every call, so an edit applies without a restart.
      `,
      javaGetter: `
        if ( endpointIsSet_ ) return endpoint_;
        foam.core.auth.Credential cred = (foam.core.auth.Credential)
          ((foam.dao.DAO) getX().get("credentialDAO")).find("foam/llm/openai");
        if ( cred == null || foam.util.SafetyUtil.isEmpty(cred.getUrl()) ) return "https://api.openai.com/v1/embeddings";
        String url = cred.getUrl();
        return ( url.endsWith("/") ? url.substring(0, url.length() - 1) : url ) + "/v1/embeddings";
      `
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
      documentation: 'Read from the credential on every call, as the endpoint is, so a key and url changed together are used together on the next call.',
      javaGetter: `
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
