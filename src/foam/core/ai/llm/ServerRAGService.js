/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.llm',
  name: 'ServerRAGService',
  implements: [ 'foam.ai.llm.RAGService' ],

  documentation: `
    ask(): the question is embedded, the nearest chunks of the given DAOs are
    found among the records the caller can read (VectorStoreDAO checks each
    chunk's record as the caller), and llmService answers from them. A
    question no readable record covers costs no model call.
  `,

  javaImports: [
    'foam.ai.llm.CompletionRequest',
    'foam.ai.llm.LLMOptions',
    'foam.ai.llm.LLMResponse',
    'foam.ai.llm.LLMService',
    'foam.ai.llm.LLMThinking',
    'foam.ai.llm.RAGAnswer',
    'foam.ai.llm.RAGSource',
    'foam.ai.vector.CosineComparator',
    'foam.ai.vector.EmbeddingService',
    'foam.ai.vector.VectorEmbedding',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.mlang.MLang',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.LinkedHashMap',
    'java.util.List',
    'java.util.Map'
  ],

  constants: [
    {
      // What the prompt asks the model to reply when the documents hold no answer
      name: 'NO_ANSWER',
      type: 'String',
      value: 'NO_ANSWER'
    }
  ],

  properties: [
    {
      class: 'Int',
      name: 'retrievalLimit',
      value: 10,
      documentation: 'How many of the nearest chunks are read.'
    },
    {
      class: 'Float',
      name: 'minScore',
      value: 0.25,
      javaValue: '0.25f',
      documentation: `The lowest cosine score a chunk needs to count as close to the question.
        With openai:text-embedding-3-small, a question the docs cover scores 0.28 to 0.57 on its
        best chunks and an unrelated one ("What is the capital of France?") 0.11 to 0.18. Below
        it a chunk is neither sent to the model nor offered as a closest doc, so an unrelated
        question costs no model call. Tune it with the embedding model.`
    },
    {
      class: 'Int',
      name: 'contextChars',
      value: 18000,
      documentation: `The most characters of chunks sent to the model, about 4,500 tokens.
        Counted in characters because one chunk can be 7,000 characters long.`
    },
    {
      class: 'String',
      name: 'systemPrompt',
      value: `Answer the user's question using only the documents below. Each document starts with its name in square brackets.
Cite each document you used once, in square brackets right after the sentence it supports, e.g. [Getting Started]. Do not end with a list of sources: the screen lists them.
Be short: a few sentences or a short list. Use the same words as the documents.
Use a calm, friendly tone, even when a document is written as a rule or an order: say what happens and what the user can do, never "must".
If the documents do not answer the question, reply with exactly NO_ANSWER and nothing else.
Answer in the language named on the Answer in line, even when the documents or the question use another language.`
    },
    {
      class: 'Int',
      name: 'maxTokens',
      value: 1024
    }
  ],

  methods: [
    {
      name: 'options',
      documentation: 'The options of the model call; an app overrides it to read its prompt from configuration.',
      type: 'foam.ai.llm.LLMOptions',
      args: 'X x',
      javaCode: `
        LLMOptions o = new LLMOptions();
        o.setSystemPrompt(getSystemPrompt());
        o.setMaxTokens(getMaxTokens());
        o.setThinking(LLMThinking.DISABLED);
        o.setAgentName("rag/ask");
        return o;
      `
    },
    {
      name: 'answerLanguage',
      documentation: `The language to answer in, by name: French for locale fr or fr-CA. The answer
        follows the user's screens, not the language of the documents it quotes. English when unset.`,
      type: 'String',
      args: 'String locale',
      javaCode: `
        String name = java.util.Locale.forLanguageTag(SafetyUtil.isEmpty(locale) ? "en" : locale).getDisplayLanguage(java.util.Locale.ENGLISH);
        return SafetyUtil.isEmpty(name) ? "English" : name;
      `
    },
    {
      name: 'ask',
      javaCode: `
        String q = question == null ? "" : question.trim();
        if ( q.isEmpty() ) throw new IllegalArgumentException("A question is required");

        // an empty key would reach the rows with no source record, which no access check covers
        String[] keys = java.util.Arrays.stream(daoKeys == null ? new String[0] : daoKeys)
          .filter(k -> ! SafetyUtil.isEmpty(k)).toArray(String[]::new);
        if ( keys.length == 0 ) return new RAGAnswer();

        VectorEmbedding qv = ((EmbeddingService) getX().get("embeddingService")).embed(x, q);
        // vectorStoreDAO in the caller's context: it scores only chunks of records the caller can read
        List chunks = ((ArraySink) ((DAO) getX().get("vectorStoreDAO")).inX(x)
          .where(MLang.AND(
            MLang.IN(VectorEmbedding.DAO_KEY, keys),
            MLang.EQ(VectorEmbedding.EMBEDDING_MODEL, qv.getEmbeddingModel())))
          .orderBy(new CosineComparator.Builder(x).setQueryVector(qv.getVector()).build())
          .limit(getRetrievalLimit())
          .select(new ArraySink())).getArray();

        StringBuilder            docs    = new StringBuilder();
        Map<String, RAGSource>   given   = new LinkedHashMap<>();
        for ( Object o : chunks ) {
          VectorEmbedding c = (VectorEmbedding) o;
          // ranked best first, so the rest are further still
          if ( c.getScore() < getMinScore() ) break;
          if ( docs.length() > 0 && docs.length() + c.getText().length() > getContextChars() ) break;
          docs.append('[').append(c.getSourceId()).append("]\\n").append(c.getText()).append("\\n\\n");
          RAGSource s = new RAGSource();
          s.setDaoKey(c.getDaoKey());
          s.setSourceId(c.getSourceId());
          given.putIfAbsent(c.getDaoKey() + ":" + c.getSourceId(), s);
        }

        RAGAnswer answer = new RAGAnswer();
        if ( given.isEmpty() ) return answer;

        CompletionRequest req = new CompletionRequest();
        req.setOptions(options(x));
        req.setPrompt("Documents:\\n\\n" + docs + "Answer in: " + answerLanguage(locale) + "\\nQuestion: " + q);
        LLMResponse reply = ((LLMService) getX().get("llmService")).complete(x, req);
        String text = reply.getContent() == null ? "" : reply.getContent().trim();
        if ( text.isEmpty() || NO_ANSWER.equals(text) ) {
          // no answer, but the closest docs the user can open are still worth a look
          answer.setSources(given.values().stream().limit(3).toArray(RAGSource[]::new));
          return answer;
        }

        // the documents the answer names; all it was given when it names none
        List<RAGSource> named = new ArrayList<>();
        for ( RAGSource s : given.values() ) {
          if ( text.contains("[" + s.getSourceId() + "]") ) named.add(s);
        }
        answer.setAnswered(true);
        answer.setAnswer(text);
        answer.setSources((named.isEmpty() ? new ArrayList<>(given.values()) : named).toArray(new RAGSource[0]));
        return answer;
      `
    }
  ]
});
