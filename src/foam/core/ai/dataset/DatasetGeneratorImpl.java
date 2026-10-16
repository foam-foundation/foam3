/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ai.dataset;

import foam.ai.llm.CompletionRequest;
import foam.ai.llm.LLMOptions;
import foam.ai.llm.LLMResponse;
import foam.ai.llm.LLMService;
import foam.dao.DAO;
import foam.lang.X;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.stream.Stream;
import org.json.JSONArray;
import org.json.JSONObject;

public class DatasetGeneratorImpl extends DatasetGenerator {

  public DatasetGeneratorImpl(X x) { setX(x); }

  @Override
  public void execute(X x) {
    LLMService llm = (LLMService) x.get("llmService");
    DAO        dao = (DAO)        x.get("datasetDAO");

    for ( String rootPath : getSourcePaths() ) {
      Path root = Paths.get(rootPath);
      if ( ! Files.isDirectory(root) ) {
        System.err.println("[DatasetGenerator] Not a directory, skipping: " + rootPath);
        continue;
      }
      try ( Stream<Path> walk = Files.walk(root) ) {
        Stream<Path> files = walk.filter(Files::isRegularFile)
                                 .filter(p -> hasExtension_(p));
        if ( getMaxFiles() > 0 ) files = files.limit(getMaxFiles());
        files.forEach(p -> {
          try {
            processFile_(x, p, llm, dao);
          } catch ( Exception e ) {
            System.err.println("[DatasetGenerator] Error on " + p + ": " + e.getMessage());
          }
        });
      } catch ( IOException e ) {
        System.err.println("[DatasetGenerator] Walk failed for " + rootPath + ": " + e.getMessage());
      }
    }
    System.out.println("[DatasetGenerator] Done.");
  }

  protected void processFile_(X x, Path filePath, LLMService llm, DAO dao) {
    String content;
    try {
      content = Files.readString(filePath, StandardCharsets.UTF_8);
    } catch ( IOException e ) {
      System.err.println("[DatasetGenerator] Cannot read " + filePath + ": " + e.getMessage());
      return;
    }

    content = anonymize_(content);

    String   ext      = extension_(filePath.toString());
    String   language = languageOf_(ext);
    String[] chunks   = chunkContent_(content, ext);

    int stored = 0;
    for ( String chunk : chunks ) {
      if ( chunk.trim().length() < 80 ) continue;
      try {
        String json = callLLM_(x, chunk, filePath.toString(), llm);
        stored += parseAndStore_(x, json, filePath.toString(), language, dao);
      } catch ( Exception e ) {
        System.err.println("[DatasetGenerator] LLM/store error for chunk in "
          + filePath + ": " + e.getMessage());
      }
    }
    if ( stored > 0 )
      System.out.println("[DatasetGenerator] " + filePath.getFileName() + " -> " + stored + " samples");
  }

  protected String[] chunkContent_(String content, String ext) {
    List<String> chunks = new ArrayList<>();

    if ( ".js".equals(ext) ) {
      // Each top-level FOAM declaration becomes its own chunk
      String[] parts = content.split("(?=\nfoam\\.(CLASS|INTERFACE|ENUM|RELATIONSHIP)\\s*\\()");
      for ( String p : parts ) {
        String t = p.trim();
        if ( t.length() > 80 ) chunks.add(t);
      }
    } else if ( ".jrl".equals(ext) ) {
      // Each p({...}) journal entry is one chunk
      String[] parts = content.split("(?=\np\\s*\\()");
      for ( String p : parts ) {
        String t = p.trim();
        if ( t.length() > 30 ) chunks.add(t);
      }
    } else if ( ".md".equals(ext) ) {
      // Split before each heading; oversized sections fall back to size-based splitting
      String[] parts = content.split("(?=\n#{1,3} )");
      for ( String p : parts ) {
        String t = p.trim();
        if ( t.length() < 80 ) continue;
        if ( t.length() <= getMaxChunkSize() ) {
          chunks.add(t);
        } else {
          chunks.addAll(chunkBySize_(t));
        }
      }
    } else {
      chunks = chunkBySize_(content);
    }

    return chunks.toArray(new String[0]);
  }

  protected List<String> chunkBySize_(String content) {
    List<String>  chunks  = new ArrayList<>();
    String[]      paras   = content.split("\\n\\n+");
    StringBuilder current = new StringBuilder();

    for ( String para : paras ) {
      if ( current.length() + para.length() > getMaxChunkSize() && current.length() > 0 ) {
        chunks.add(current.toString().trim());
        current = new StringBuilder();
      }
      current.append(para).append("\n\n");
    }
    if ( current.toString().trim().length() > 80 )
      chunks.add(current.toString().trim());

    return chunks;
  }

  protected String anonymize_(String text) {
    String[] patterns = getAnonymizePatterns();
    for ( int i = 0; i + 1 < patterns.length; i += 2 ) {
      text = text.replaceAll(patterns[i], patterns[i + 1]);
    }
    return text;
  }

  protected String callLLM_(X x, String chunk, String filePath, LLMService llm) {
    String systemPrompt =
      "You are an expert FOAM framework developer. FOAM is a JavaScript/Java meta-programming " +
      "framework where models are declared with foam.CLASS({...}), supporting reactive properties " +
      "(slots), methods, actions, listeners, and templates. It includes a reactive UI layer " +
      "(foam.u2), a DAO persistence layer, and a COMICS framework for CRUD UI generation.\n\n" +
      "You will receive a chunk of real FOAM source code. Use it to identify which FOAM patterns, " +
      "idioms, or concepts it demonstrates. Then generate exactly " + getSamplesPerChunk() + " " +
      "instruction-answer training pairs that teach those patterns to a FOAM developer.\n\n" +
      "Return ONLY a valid JSON object — no markdown fences, no commentary — with this structure:\n" +
      "{\"samples\": [{\"instruction\": \"...\", \"input\": \"...\", \"output\": \"...\"}]}\n\n" +
      "CRITICAL — instruction phrasing:\n" +
      "- Instructions MUST be phrased at the FOAM pattern level, NOT tied to the domain class in the source.\n" +
      "- BAD: \"Add a method to the Recipe class that calculates total ingredients\"\n" +
      "- GOOD: \"Add a computed method to a FOAM class\"\n" +
      "- BAD: \"Configure the DatasetGenerator service in a .jrl file\"\n" +
      "- GOOD: \"Wire a server-side Java service as a CSpec entry in a FOAM .jrl journal file\"\n" +
      "- The instruction should be something any FOAM developer might ask, regardless of their domain.\n\n" +
      "input field:\n" +
      "- For code-generation tasks (from scratch): leave input empty.\n" +
      "- For extension or explanation tasks: put a minimal, self-contained FOAM code snippet in input " +
      "that sets up the context — it can be simplified from the source chunk but must be idiomatic.\n\n" +
      "output field:\n" +
      "- FOAM .js files have NO file-level import or package statements. Never write 'import foam.core...' " +
      "or 'package com.example;' at the top of a .js output. These do not exist in FOAM.\n" +
      "- A FOAM class always starts directly with foam.CLASS({ and declares its package inside: " +
      "foam.CLASS({ package: 'com.example.myapp', name: 'MyClass', ... }).\n" +
      "- To reference other FOAM classes on the JavaScript side, use requires: ['foam.dao.EasyDAO', " +
      "'com.example.Foo']. This makes them available as this.EasyDAO, this.Foo inside the class. " +
      "requires is FOAM's equivalent of imports for .js files.\n" +
      "- Java imports belong inside javaImports: [...] within the foam.CLASS block, only when the class " +
      "has javaCode or javaFactory that needs them.\n" +
      "- For pure .java implementation files, use normal Java package + import statements at the top.\n" +
      "- Code must be idiomatic FOAM: correct property classes (String, Int, Boolean, FObjectProperty, etc.), " +
      "javaFactory where needed, proper slot usage, self vs this in foam.u2 render().\n" +
      "- Explanations must be precise and reference correct FOAM concepts.\n\n" +
      "Vary the task types across the samples: code generation, extending existing code, explaining a " +
      "pattern, and identifying a common mistake.";

    String userMessage = "Source chunk from " + filePath + ":\n\n" + chunk;

    LLMOptions opts = new LLMOptions();
    opts.setSystemPrompt(systemPrompt);
    if ( ! getLlmModel().isEmpty() ) opts.setModel(getLlmModel());
    opts.setMaxTokens(1200);
    opts.setTemperature(0.7f);

    CompletionRequest req = new CompletionRequest();
    req.setOptions(opts);
    req.setPrompt(userMessage);

    LLMResponse resp = llm.complete(x, req);
    return resp.getContent();
  }

  protected int parseAndStore_(X x, String json, String sourceFile, String language, DAO dao) {
    String cleaned = json.trim();
    if ( cleaned.startsWith("```") ) {
      cleaned = cleaned
        .replaceAll("^```[a-z]*\\n?", "")
        .replaceAll("```$",           "")
        .trim();
    }

    JSONObject root;
    try {
      root = new JSONObject(cleaned);
    } catch ( Exception e ) {
      System.err.println("[DatasetGenerator] JSON parse failed for " + sourceFile
        + ": " + e.getMessage()
        + "\nRaw: " + cleaned.substring(0, Math.min(200, cleaned.length())));
      return 0;
    }

    JSONArray samples = root.optJSONArray("samples");
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
      sample.setSourceFile(sourceFile);
      sample.setLanguage(language);

      dao.put(sample);
      count++;
    }
    return count;
  }

  protected String hash_(String text) {
    try {
      MessageDigest md    = MessageDigest.getInstance("SHA-256");
      byte[]        bytes = md.digest(text.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(bytes).substring(0, 16);
    } catch ( Exception e ) {
      throw new RuntimeException("SHA-256 unavailable", e);
    }
  }

  protected boolean hasExtension_(Path p) {
    String name = p.getFileName().toString();
    for ( String ext : getFileExtensions() ) {
      if ( name.endsWith(ext) ) return true;
    }
    return false;
  }

  protected String extension_(String path) {
    int dot = path.lastIndexOf('.');
    return dot >= 0 ? path.substring(dot) : "";
  }

  protected String languageOf_(String ext) {
    switch ( ext ) {
      case ".js":   return "js";
      case ".java": return "java";
      case ".jrl":  return "jrl";
      case ".md":   return "markdown";
      default:      return "mixed";
    }
  }
}
