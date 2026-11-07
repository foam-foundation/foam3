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
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.Collections',
    'java.util.HashMap',
    'java.util.HexFormat',
    'java.util.List',
    'java.util.Map',
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
      documentation: 'Source of items to process. Not needed when items is set explicitly.'
    },
    {
      class: 'StringArray',
      name: 'items',
      documentation: `
        Explicit ordered list of items to process. When non-empty the crawler is bypassed
        entirely and exactly these items are processed (subject to maxPerCategory).
        Use this to pin a curated evaluation set without changing the crawler.
      `,
      factory:     function() { return []; },
      javaFactory: `return new String[0];`
    },
    {
      class: 'Int',
      name: 'maxPerCategory',
      documentation: `
        Maximum items to process per category (as returned by categoryOf). 0 = unlimited.
        Applied after the item list is collected or resolved from the items property.
        Useful for quick evaluation runs that need a balanced sample across content types.
      `,
      value: 0
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
    },
    {
      class: 'StringArray',
      name: 'priorityPaths',
      documentation: `
        Path substrings whose matching files are processed first, before the shuffled remainder.
        Use this to front-load high-value source directories (e.g. "doc/fbe") so they are
        never crowded out when the crawl is large. Matched items preserve their original
        relative order; everything else is shuffled as usual.
      `,
      factory:     function() { return []; },
      javaFactory: `return new String[0];`
    },
    {
      class: 'StringArray',
      name: 'excludePaths',
      documentation: `
        Path substrings whose matching files are skipped entirely before any other processing.
        Applied before priority sorting and category capping so excluded files consume no quota.
        Use this to drop framework internals, module manifests, and other source that
        produces poor or misleading training data (e.g. "foam/core/boot", "pom.js").
      `,
      factory:     function() { return []; },
      javaFactory: `return new String[0];`
    },
    {
      class: 'Int',
      name: 'maxChunksPerFile',
      documentation: `
        Maximum chunks to draw from a single file. 0 = unlimited.
        When a file produces more chunks than this limit a random sample is taken
        so no single large file (e.g. a JRL with hundreds of entries) dominates
        the dataset. The shuffle is applied before truncation so the sample is
        not always biased toward the top of the file.
      `,
      value: 0
    }
  ],

  methods: [
    {
      name: 'collectBatches',
      type: 'List',
      args: 'Context x',
      javaCode: `
        String[] explicit = getItems();
        List items = new ArrayList<>(explicit.length > 0
          ? Arrays.asList(explicit)
          : ((DataCrawler) getCrawler()).collect(x));

        String[] exclude = getExcludePaths();
        if ( exclude.length > 0 ) {
          List filtered = new ArrayList<>();
          outer:
          for ( Object obj : items ) {
            String path = (String) obj;
            for ( String e : exclude ) { if ( path.contains(e) ) continue outer; }
            filtered.add(path);
          }
          items = filtered;
        }

        String[] priority = getPriorityPaths();
        if ( priority.length > 0 ) {
          List front = new ArrayList<>();
          List rest  = new ArrayList<>();
          for ( Object obj : items ) {
            String path = (String) obj;
            boolean matched = false;
            for ( String p : priority ) { if ( path.contains(p) ) { matched = true; break; } }
            if ( matched ) front.add(path); else rest.add(path);
          }
          Collections.shuffle(rest);
          front.addAll(rest);
          items = front;
        } else {
          Collections.shuffle(items);
        }

        return filterBatches_(items);
      `
    },
    {
      name: 'filterBatches_',
      type: 'List',
      args: 'List items',
      javaCode: `
        int max = getMaxPerCategory();
        if ( max <= 0 ) return items;

        Map<String, Integer> counts = new HashMap<>();
        List<String>         result = new ArrayList<>();
        for ( Object obj : items ) {
          String item  = (String) obj;
          String cat   = categoryOf(item);
          int    count = counts.getOrDefault(cat, 0);
          if ( count < max ) {
            result.add(item);
            counts.put(cat, count + 1);
          }
        }
        return result;
      `
    },
    {
      name: 'processBatch',
      args: 'Context x, String item',
      javaCode: `
        String content = ((DataCrawler) getCrawler()).fetch(x, item);
        if ( foam.util.SafetyUtil.isEmpty(content) ) return;

        content = anonymize_(content);
        String   category = categoryOf(item);
        String[] chunks   = chunk(content, item);

        int maxChunks = getMaxChunksPerFile();
        if ( maxChunks > 0 && chunks.length > maxChunks ) {
          List<String> cl = new ArrayList<>(Arrays.asList(chunks));
          Collections.shuffle(cl);
          chunks = cl.subList(0, maxChunks).toArray(new String[0]);
          System.out.println("[DatasetGenerator] " + item + " — sampled " + maxChunks + "/" + cl.size() + " chunks");
        }

        LLMService llm = (LLMService) x.get("llmService");
        DAO        dao = (DAO)        x.get("datasetDAO");

        int stored = 0;
        for ( String c : chunks ) {
          if ( c.trim().length() < 80 ) continue;
          try {
            String json = callLLM_(x, c, item, category, llm);
            if ( json == null ) continue;
            stored += parseAndStore_(x, json, item, category, dao);
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
      args: 'String content, String item',
      javaCode: `throw new UnsupportedOperationException("override chunk()");`
    },
    {
      documentation: 'Return a category tag for the item (e.g. "js", "java"). Override per content domain.',
      name: 'categoryOf',
      type: 'String',
      args: 'String item',
      javaCode: `return "";`
    },
    {
      documentation: 'Return the LLM system prompt for the given content category. Override per training domain.',
      name: 'buildSystemPrompt',
      type: 'String',
      args: 'String category',
      javaCode: `throw new UnsupportedOperationException("override buildSystemPrompt()");`
    },
    {
      name: 'callLLM_',
      type: 'String',
      args: 'Context x, String chunk, String item, String category, LLMService llm',
      javaCode: `
        LLMOptions opts = new LLMOptions();
        opts.setSystemPrompt(buildSystemPrompt(category));
        if ( ! getLlmModel().isEmpty() ) opts.setModel(getLlmModel());
        opts.setMaxTokens(getMaxTokens());
        opts.setTemperature(0.7f);

        CompletionRequest req = new CompletionRequest();
        req.setOptions(opts);
        req.setPrompt("[category: " + category + "]\\nSource chunk from " + item + ":\\n\\n" + chunk);

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
      args: 'Context x, String json, String sourceId, String category, DAO dao',
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

          // Strip markdown code fence from the output field if the LLM wrapped it.
          if ( output.startsWith("\`\`\`") ) {
            int nl = output.indexOf('\\n');
            if ( nl > 0 ) output = output.substring(nl + 1);
            if ( output.endsWith("\`\`\`") ) output = output.substring(0, output.length() - 3);
            output = output.trim();
          }

          if ( ! output.contains("{") ) {
            System.out.println("[DatasetGenerator] Skipping prose-only sample for " + sourceId
              + ": " + instruction.substring(0, Math.min(60, instruction.length())));
            continue;
          }

          String id = hash_(instruction + output);
          if ( dao.find(id) != null ) continue;

          AlpacaSample sample = new AlpacaSample();
          sample.setId(id);
          sample.setInstruction(instruction);
          sample.setInput(input);
          sample.setOutput(output);
          sample.setSourceFile(sourceId);
          sample.setCategory(category);

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
  ]
});
