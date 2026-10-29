/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'AbstractDatasetGenerator',
  implements: [ 'foam.core.job.Batchable' ],
  abstract: true,

  documentation: `
    Generic SFT dataset generation pipeline: crawl → clean → chunk → LLM → store.

    Subclasses implement chunk() to split source text for their content type, and
    buildSystemPrompt() to instruct the LLM on what training pairs to produce.
    Everything else — file fetching, anonymization, LLM calling, Alpaca-format
    deduplication, and DAO persistence — is handled here.

    Wire a DataCrawler to control where source material comes from (filesystem,
    web, DAO, etc.) without touching the pipeline.
  `,

  javaImports: [
    'foam.ai.llm.CompletionRequest',
    'foam.ai.llm.LLMOptions',
    'foam.ai.llm.LLMResponse',
    'foam.ai.llm.LLMService',
    'foam.dao.DAO',
    'java.nio.charset.StandardCharsets',
    'java.security.MessageDigest',
    'java.util.HexFormat',
    'java.util.List',
    'org.json.JSONArray',
    'org.json.JSONObject',
    'java.util.regex.Matcher',
    'java.util.regex.Pattern'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.ai.dataset.DataCrawler',
      name: 'crawler',
      documentation: 'Source of items to process.',
      required: true
    },
    {
      class: 'StringArray',
      name: 'anonymizePatterns',
      documentation: `
        Interleaved [find, replace] pairs applied to each item's content before
        it reaches the LLM. Set in your run script; do not commit sensitive names here.
      `,
      factory:     function() { return []; },
      javaFactory: `return new String[0];`
    },
    {
      class: 'Int',
      name: 'samplesPerChunk',
      documentation: 'Instruction-answer pairs requested per chunk.',
      value: 3
    },
    {
      class: 'Int',
      name: 'maxChunkSize',
      documentation: 'Max characters per chunk for size-based splitting.',
      value: 2000
    },
    {
      class: 'String',
      name: 'llmModel',
      documentation: 'Model id forwarded to LLMOptions. Empty = provider default.',
      value: 'gpt-4o-mini'
    },
    {
      class: 'Int',
      name: 'maxTokens',
      documentation: 'Maximum tokens in the LLM response per chunk.',
      value: 2048
    }
  ],

  methods: [
    {
      name: 'collectBatches',
      type: 'List',
      args: 'Context x',
      javaCode: `return ((DataCrawler) getCrawler()).collect(x);`
    },
    {
      name: 'processBatch',
      args: 'Context x, String item',
      javaCode: `
        String content = ((DataCrawler) getCrawler()).fetch(x, item);
        if ( foam.util.SafetyUtil.isEmpty(content) ) return;

        content = anonymize_(content);
        String   ext      = extension_(item);
        String   language = languageOf_(ext);
        String[] chunks   = chunk(content, ext);

        LLMService llm = (LLMService) x.get("llmService");
        DAO        dao = (DAO)        x.get("datasetDAO");

        int stored = 0;
        for ( String c : chunks ) {
          if ( c.trim().length() < 80 ) continue;
          try {
            String json = callLLM_(x, c, item, llm);
            if ( json == null ) continue;
            stored += parseAndStore_(x, json, item, language, dao);
          } catch ( Exception e ) {
            System.err.println("[DatasetGenerator] LLM/store error for chunk in " + item + ": " + e.getMessage());
          }
        }
        if ( stored > 0 )
          System.out.println("[DatasetGenerator] " + item + " -> " + stored + " samples");
      `
    },
    {
      documentation: 'Split content into chunks suitable for LLM prompting. Override per content type.',
      name: 'chunk',
      type: 'String[]',
      args: 'String content, String ext',
      javaCode: `throw new UnsupportedOperationException("override chunk()");`
    },
    {
      documentation: 'Return the LLM system prompt for this dataset. Override per training domain.',
      name: 'buildSystemPrompt',
      type: 'String',
      javaCode: `throw new UnsupportedOperationException("override buildSystemPrompt()");`
    },
    {
      name: 'callLLM_',
      type: 'String',
      args: 'Context x, String chunk, String item, LLMService llm',
      javaCode: `
        LLMOptions opts = new LLMOptions();
        opts.setSystemPrompt(buildSystemPrompt());
        if ( ! getLlmModel().isEmpty() ) opts.setModel(getLlmModel());
        opts.setMaxTokens(getMaxTokens());
        opts.setTemperature(0.7f);

        CompletionRequest req = new CompletionRequest();
        req.setOptions(opts);
        req.setPrompt("Source chunk from " + item + ":\\n\\n" + chunk);

        LLMResponse resp = llm.complete(x, req);

        if ( "length".equals(resp.getStopReason()) ) {
          System.out.println("[DatasetGenerator] TRUNCATED (maxTokens=" + getMaxTokens()
            + "): " + item + " — response cut off, skipping chunk."
            + " Increase maxTokens or reduce maxChunkSize.");
          return null;
        }

        return resp.getContent();
      `
    },
    {
      name: 'parseAndStore_',
      type: 'int',
      args: 'Context x, String json, String sourceId, String language, DAO dao',
      javaCode: `
        String cleaned = json.trim();

        // Strip markdown code fence if the LLM wrapped its response
        if ( cleaned.length() >= 3
          && cleaned.charAt(0) == '\`'
          && cleaned.charAt(1) == '\`'
          && cleaned.charAt(2) == '\`' ) {
          int nl = cleaned.indexOf('\\n');
          if ( nl > 0 ) cleaned = cleaned.substring(nl + 1);
          if ( cleaned.endsWith("\`\`\`") ) cleaned = cleaned.substring(0, cleaned.length() - 3);
          cleaned = cleaned.trim();
        }

        JSONArray samples = null;
        try {
          samples = new JSONObject(cleaned).optJSONArray("samples");
        } catch ( Exception e ) {
          samples = extractSamplesFallback_(cleaned);
          if ( samples == null || samples.length() == 0 ) {
            System.err.println("[DatasetGenerator] Skipping unparseable LLM response for " + sourceId
              + " (bad JSON from model — likely unescaped quotes in output field)");
            return 0;
          }
        }
        if ( samples == null ) return 0;

        int count = 0;
        for ( int i = 0; i < samples.length(); i++ ) {
          JSONObject s       = samples.getJSONObject(i);
          String instruction = s.optString("instruction", "").trim();
          String input       = s.optString("input",       "").trim();
          String output      = s.optString("output",      "").trim();

          if ( instruction.isEmpty() || output.isEmpty() ) continue;

          String id = hash_(instruction + output);
          if ( dao.find(id) != null ) continue;

          AlpacaSample sample = new AlpacaSample();
          sample.setId(id);
          sample.setInstruction(instruction);
          sample.setInput(input);
          sample.setOutput(output);
          sample.setSourceFile(sourceId);
          sample.setLanguage(language);

          dao.put(sample);
          count++;
        }
        return count;
      `
    },
    {
      name: 'extractSamplesFallback_',
      type: 'JSONArray',
      args: 'String text',
      javaCode: `
        // Pull out individual {"instruction":...,"output":...} objects using a
        // best-effort scan. Stops at the first object that fails to parse.
        JSONArray out     = new JSONArray();
        Pattern   pat     = Pattern.compile("\\\\{[^{}]*\\"instruction\\"[^{}]*\\\\}");
        Matcher   matcher = pat.matcher(text);
        while ( matcher.find() ) {
          try {
            JSONObject obj = new JSONObject(matcher.group());
            if ( ! obj.optString("instruction").isEmpty()
              && ! obj.optString("output").isEmpty() ) {
              out.put(obj);
            }
          } catch ( Exception ignored ) {}
        }
        return out.length() > 0 ? out : null;
      `
    },
    {
      name: 'anonymize_',
      type: 'String',
      args: 'String text',
      javaCode: `
        String[] patterns = getAnonymizePatterns();
        for ( int i = 0; i + 1 < patterns.length; i += 2 )
          text = text.replace(patterns[i], patterns[i + 1]);
        return text;
      `
    },
    {
      name: 'hash_',
      type: 'String',
      args: 'String text',
      javaCode: `
        try {
          MessageDigest md    = MessageDigest.getInstance("SHA-256");
          byte[]        bytes = md.digest(text.getBytes(StandardCharsets.UTF_8));
          return HexFormat.of().formatHex(bytes).substring(0, 16);
        } catch ( Exception e ) {
          throw new RuntimeException("SHA-256 unavailable", e);
        }
      `
    },
    {
      name: 'extension_',
      type: 'String',
      args: 'String path',
      javaCode: `
        int dot = path.lastIndexOf('.');
        return dot >= 0 ? path.substring(dot) : "";
      `
    },
    {
      name: 'languageOf_',
      type: 'String',
      args: 'String ext',
      javaCode: `
        switch ( ext ) {
          case ".js":   return "js";
          case ".java": return "java";
          case ".md":   return "markdown";
          default:      return "mixed";
        }
      `
    }
  ]
});
