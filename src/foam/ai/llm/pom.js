/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'llm',
  files: [
    { name: 'LLMService',               flags: 'js|java' },
    { name: 'ConversationalLLMService', flags: 'js'      },
    { name: 'RAGService',               flags: 'js|java' },
    { name: 'RAGChat',                  flags: 'js'      },
    { name: 'RAGChatPanel',             flags: 'js'      }
  ],
  projects: [
    { name: 'provider/pom' }
  ]
});
