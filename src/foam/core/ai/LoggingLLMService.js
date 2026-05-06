/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai',
  name: 'LoggingLLMService',
  extends: 'foam.core.ai.ProxyLLMService',

  documentation: `
    Decorator that logs LLM requests, token usage, latency, and errors.
    Stack via CSpec decorators just like DAO decorators.
  `,

  javaImports: [
    'foam.core.logger.Logger'
  ],

  methods: [
    {
      name: 'complete',
      javaCode: `
        Logger logger = (Logger) x.get("logger");
        long   start  = System.currentTimeMillis();
        try {
          CompletionResponse response = getDelegate().complete(x, request);
          long ms = System.currentTimeMillis() - start;
          logger.info(
            this.getClass().getSimpleName(),
            "complete",
            "model=" + response.getModel(),
            "in=" + response.getInputTokens(),
            "out=" + response.getOutputTokens(),
            ms + "ms"
          );
          return response;
        } catch ( Exception e ) {
          long ms = System.currentTimeMillis() - start;
          logger.error(
            this.getClass().getSimpleName(),
            "complete", "FAILED",
            e.getMessage(),
            ms + "ms"
          );
          throw e;
        }
      `
    },
    {
      name: 'chat',
      javaCode: `
        Logger logger = (Logger) x.get("logger");
        long   start  = System.currentTimeMillis();
        try {
          CompletionResponse response = getDelegate().chat(x, messages, options);
          long ms = System.currentTimeMillis() - start;
          logger.info(
            this.getClass().getSimpleName(),
            "chat",
            "model=" + response.getModel(),
            "in=" + response.getInputTokens(),
            "out=" + response.getOutputTokens(),
            ms + "ms"
          );
          return response;
        } catch ( Exception e ) {
          long ms = System.currentTimeMillis() - start;
          logger.error(
            this.getClass().getSimpleName(),
            "chat", "FAILED",
            e.getMessage(),
            ms + "ms"
          );
          throw e;
        }
      `
    }
  ]
});
