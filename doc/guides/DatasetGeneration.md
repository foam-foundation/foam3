<!-- cspell:ignore spid Batchable subclassing anonymize anonymization Chunker mycompany myapp myco myproject Resumability ALANG datasetDAO jobDAO scriptDAO daoKey summaryView AlpacaSampleBrowseView DAOMenu runKey BEANSHELL ClassInfoImpl forClass getOwnClassInfo -->
<flow name="DatasetGeneration" category="DOC/GUIDE" spid="foam" description="Covers SFT dataset generation for FOAM models: AbstractDatasetGenerator pipeline, Alpaca format, categories, chunking strategies, per-category system prompts, eval modes, viewing samples, and running jobs." keywords="dataset,SFT,fine-tuning,training,AlpacaSample,AbstractDatasetGenerator,chunking,LLM,BatchJob,FileCrawler,knowledge"/>

# Dataset Generation: Training a Model on FOAM Code

FOAM's dataset generation pipeline converts source files into Alpaca-format instruction–answer pairs suitable for supervised fine-tuning (SFT) of a language model. The pipeline is built around `foam.core.ai.dataset.AbstractDatasetGenerator` — an abstract base class you subclass to add domain knowledge. Everything else — file fetching, anonymization, LLM calling, deduplication, and DAO persistence — is handled by the base class.

## Why a FOAM-native Pipeline

Generating training data from a live codebase has three specific requirements:

1. **Freshness** — the data must reflect the current source, not a snapshot.
2. **Anonymization** — internal class names, package names, and company identifiers must be replaced before content reaches any external LLM API.
3. **Category awareness** — a `.js` FOAM model, a `.java` implementation class, a `.jrl` journal, and a `.md` guide require different prompting strategies and produce structurally different training pairs.

Encoding these requirements in a FOAM NanoService means the pipeline is configurable through the standard FOAM property system, observable through the standard job UI, and extendable through normal subclassing.

## The Pipeline

`AbstractDatasetGenerator` implements the `Batchable` interface. The `BatchJob` wrapper calls `collectBatches(x)` to get the item list, then calls `processBatch(x, item)` for each item. Each item goes through five stages:

```
fetch → anonymize → chunk → LLM → store
```

| Stage | What happens |
|---|---|
| `fetch` | `DataCrawler.fetch(x, item)` returns the raw file content as a String |
| `anonymize` | Interleaved find/replace pairs strip internal identifiers before the LLM sees them |
| `chunk` | Your subclass splits content into segments small enough for one LLM call |
| `LLM` | Each chunk is sent to the configured LLM with a system prompt from your subclass |
| `store` | Parsed instruction–answer pairs are deduplicated by SHA-256 hash and written to `datasetDAO` |

## The Alpaca Format

Each stored record is an `AlpacaSample` with four meaningful fields:

| Field | Purpose |
|---|---|
| `instruction` | The training question — phrased at the FOAM pattern level, never domain-specific |
| `input` | Optional starting context (a class skeleton, a partial snippet) for extension tasks; empty for from-scratch tasks |
| `output` | The answer — always contains working code |
| `category` | The content-type tag set by your `categoryOf` implementation |

The `instruction` field is the most important to get right. It must be domain-neutral so the model learns the FOAM pattern, not the specific business logic:

```
BAD:  "Add a method to the InvoiceService that calculates tax"
GOOD: "Add a computed method to a JavaScript FOAM class"

BAD:  "Configure the PaymentGateway service in a .jrl file"
GOOD: "Register a Java service as a CSpec entry in a FOAM .jrl journal file"
```

Stripping domain vocabulary from instructions is enforced in your system prompt. The base class also post-filters: samples where `output` contains no `{` are logged and discarded as prose-only responses.

## Implementing Your Generator

If you choose to write a pure Java class (rather than a FOAM `.js` model with `javaCode`), extend `AbstractDatasetGenerator` and override three methods. Because it is a plain Java class rather than a generated FOAM model, you also need two `ClassInfo` methods so the FOAM runtime can identify the class:

```java
package com.myapp.dataset;

import foam.core.ai.dataset.AbstractDatasetGenerator;
import foam.lang.X;

public class MyDatasetGenerator extends AbstractDatasetGenerator {

  public MyDatasetGenerator() {}
  public MyDatasetGenerator(X x) { super(x); }

  @Override public foam.lang.ClassInfo getClassInfo()    { return foam.lang.ClassInfoImpl.forClass(getClass()); }
  public static foam.lang.ClassInfo    getOwnClassInfo() { return foam.lang.ClassInfoImpl.forClass(MyDatasetGenerator.class); }

  @Override public String   categoryOf(String item)           { ... }
  @Override public String[] chunk(String content, String item) { ... }
  @Override public String   buildSystemPrompt(String category) { ... }
}
```

> **Note:** The `ClassInfo` boilerplate is required for every pure Java class in FOAM. If you skip it the runtime cannot identify the class and injection will fail silently.
> See **[WritingJavaCode.md](WritingJavaCode.md)** for the full pattern, when to choose a pure Java class over a `.js` FOAM model with `javaCode`, and what other boilerplate is needed.
```

### categoryOf

Maps an item (typically a file path) to a string tag. The tag controls which system prompt the chunk gets, how `maxPerCategory` filtering counts items, and what appears in the `category` field on stored samples.

A simple approach is to switch on file extension. You can layer in path-based signals on top — for example, FOAM test files look like any other `.js` or `.java` file by extension, but they always live in a `test/` subdirectory:

```java
@Override
public String categoryOf(String item) {
  if ( item.contains("/test/") ) return "test";  // path-based check first

  int dot = item.lastIndexOf('.');
  String ext = dot >= 0 ? item.substring(dot) : "";
  switch ( ext ) {
    case ".js":   return "js";
    case ".java": return "java";
    case ".jrl":  return "jrl";
    case ".md":   return "markdown";
    default:      return "mixed";
  }
}
```

The categories you define here are entirely up to you. What matters is that each category gets its own system prompt (see `buildSystemPrompt` below) and that the names are stable — they appear as `category` on every stored sample and are how you filter and review results.

### chunk

Splits raw file content into segments suitable for one LLM call. The right boundary depends on the file type. The base class provides `getMaxChunkSize()` (default 2000 characters) and a protected `chunkBySize_(String content)` fallback you can use as a starting point.

The key insight is that a meaningful chunk boundary is better than a size boundary. Splitting a JavaScript file mid-class produces fragments the LLM cannot reason about. Splitting a Java file at each method produces chunks that each have a clear, teachable purpose.

For **JavaScript FOAM**, the natural boundary is the top-level declaration. Each `foam.CLASS`, `foam.INTERFACE`, or `foam.ENUM` is self-contained. You could split on those:

```java
// Split on foam.CLASS / foam.INTERFACE / foam.ENUM / etc.
String[] parts = content.split(
  "(?=\nfoam\\.(CLASS|INTERFACE|ENUM|RELATIONSHIP|LIB|FSM|SCRIPT)\\s*\\()");
List<String> chunks = new ArrayList<>();
for ( String p : parts ) {
  if ( p.trim().length() > 80 ) chunks.add(p.trim());
}
```

For **Java**, one chunk per method works well. Extract the class header (package + imports + class declaration) once, then walk the body tracking brace depth — each top-level close brace ends one member:

```java
// Find the class opening brace
Pattern classPattern = Pattern.compile("\\b(?:class|interface|enum)\\b[^{]*\\{");
Matcher m = classPattern.matcher(content);
if ( ! m.find() ) return chunkBySize_(content);

String header = content.substring(0, m.end()).trim();
String body   = content.substring(m.end());
List<String> chunks = new ArrayList<>();
int depth = 0, start = 0;

for ( int i = 0; i < body.length(); i++ ) {
  char c = body.charAt(i);
  if      ( c == '{' ) { depth++; }
  else if ( c == '}' ) {
    if ( --depth < 0 ) break;          // class closing brace — done
    if ( depth == 0 ) {
      String member = body.substring(start, i + 1).trim();
      if ( ! member.isEmpty() )
        chunks.add(header + "\n\n  " + member + "\n}");
      start = i + 1;
    }
  } else if ( c == ';' && depth == 0 ) {
    String member = body.substring(start, i + 1).trim();
    if ( ! member.isEmpty() )
      chunks.add(header + "\n\n  " + member + "\n}");
    start = i + 1;
  }
}
return chunks.isEmpty() ? chunkBySize_(content) : chunks;
```

Each chunk is then the class header plus one member — complete enough for the LLM to understand context, small enough to fit in one call.

For **Markdown**, a good option is to use the built-in `MarkdownChunkerServiceImpl`, which splits by heading hierarchy and aggregates sections up to a character limit. Pass `SourceType.CODE` so it preserves fenced code blocks rather than stripping them — a chunk that contains both a prose explanation and a working code example tends to produce much better training pairs than either alone:

```java
MarkdownChunkerServiceImpl mdChunker = new MarkdownChunkerServiceImpl(getX());
mdChunker.setSourceType(SourceType.CODE);
mdChunker.setMaxChunkChars(getMaxChunkSize());
for ( String c : mdChunker.chunk(getX(), content) ) {
  if ( c.trim().length() >= 80 ) chunks.add(c.trim());
}
```

### buildSystemPrompt

Returns the LLM system prompt for a given category. Every prompt must instruct the LLM to return `{"samples": [...]}` — the base class parses that structure. A reliable structure is:

1. **Role** — describe the expert persona
2. **Task** — "Generate exactly N instruction-answer pairs" (use `getSamplesPerChunk()`)
3. **Output format** — JSON only, no markdown fences, exact schema
4. **Instruction phrasing rules** — strip domain vocabulary, use pattern-level language
5. **Category label requirement** — mandatory in every instruction, with BAD/GOOD examples
6. **Output field constraints** — what valid code looks like for this category

The category label requirement is the hardest to enforce. Without explicit "No exceptions" language and concrete examples, LLMs treat "language-specific" as permission to omit the label for "generic" tasks. Two or three BAD/GOOD pairs per category are enough to set the pattern:

```java
@Override
public String buildSystemPrompt(String category) {
  String base = """
      You are an expert FOAM framework developer. You will receive a chunk of \
      FOAM source code. Identify the FOAM patterns it demonstrates, then generate \
      exactly %d instruction-answer training pairs that teach those patterns.

      Return ONLY a valid JSON object — no markdown fences, no commentary:
      {"samples": [{"instruction": "...", "input": "...", "output": "..."}]}

      CRITICAL — instruction phrasing:
      - Strip ALL domain vocabulary: class names, method names, service names.
      - Replace with generic FOAM or programming concepts.
      - The category label MUST appear in every instruction. No exceptions.

      """.formatted(getSamplesPerChunk());

  switch ( category ) {
    case "js": return base + """
        Every instruction MUST include 'JavaScript FOAM' or 'FOAM JavaScript'. No exceptions.
        - BAD:  "Add a reactive property to a FOAM class"
        - GOOD: "Add a reactive property to a JavaScript FOAM class"
        Every output MUST contain working foam.CLASS({...}) code.
        """;

    case "java": return base + """
        Every instruction MUST include 'in Java'. No exceptions.
        - BAD:  "Look up a DAO from the context"
        - GOOD: "Look up a DAO from the FOAM context in Java"
        Outputs must be valid Java files with package and import statements.
        """;

    case "jrl": return base + """
        Every instruction MUST reference the format — include 'FOAM .jrl journal', \
        'journal entry', or '.jrl file'. No exceptions.
        - BAD:  "Register a service in the FOAM context"
        - GOOD: "Register a Java service via a CSpec entry in a FOAM .jrl journal file"
        Outputs must be valid .jrl entries: p({...}), c({...}), or r({...}).
        """;

    default: return base + """
        Every instruction MUST include 'in FOAM'. No exceptions.
        Every output MUST contain a working FOAM code example — never prose only.
        """;
  }
}
```

The category tag is also prepended to the user message by the base class, so the LLM sees it in the prompt body as well as the system prompt:

```
[category: js]
Source chunk from /path/to/file.js:

<chunk content>
```

## FileCrawler

`foam.core.ai.dataset.FileCrawler` discovers and fetches files from the local filesystem. Configure it with source paths, allowed extensions, and a file-size limit:

```java
FileCrawler crawler = new FileCrawler(x);
crawler.setSourcePaths(new String[] {
  HOME + "/github/myproject/src",
  HOME + "/github/myproject/doc"
});
crawler.setFileExtensions(new String[] { ".js", ".java", ".jrl", ".md" });
crawler.setMaxFileSize(100_000L);  // skip files over 100 KB — avoids large data files
```

Once configured, the crawler handles both discovery and content fetching — the pipeline calls it for you. You only need to wire it to the generator via `delegate.setCrawler(crawler)`.

## Running Your First Generation

Start small and build up confidence before running across everything. A good progression:

**1 — Curated list first.** Pick a handful of representative files — one or two from each category you plan to support. Pass them as an explicit `items` array so you have complete control over what the LLM sees. Iterate on prompts and chunking without waiting for a full crawl. Run this repeatedly as you tune.

**2 — Balanced sample next.** Once you're happy with how each file type looks, switch to `maxPerCategory` with a small number (3–5). The crawler discovers all files automatically and the generator takes the first *n* from each category — a quick sanity check across the whole codebase without maintaining a list.

**3 — Full run last.** Remove the category cap and let the crawler run everything. Only do this once the prompts are stable — regenerating the full dataset is expensive.

The run script section below shows how to wire these two modes into a single script with a one-line toggle.

## Writing the Run Script

A `BatchJob` can be submitted in any way that puts a job to `jobDAO` — from a REST call, a rule action, a cron entry, or anything else that has access to the context. One of the easiest ways to get started and iterate on configuration is a BeanShell script registered as a `foam.core.script.Script`: it runs on demand with a single click and lets you tweak anonymization patterns, LLM model, chunk size, and eval mode without redeploying. Keep it in version control so you can reproduce any past run. For example, you could create a script similar to this:

```bsh
import foam.core.ai.dataset.FileCrawler;
import foam.core.job.BatchJob;
import com.myapp.dataset.MyDatasetGenerator;
import foam.dao.DAO;

String HOME   = System.getProperty("user.home");
String GITHUB = HOME + "/github/myproject";

String[] SOURCE_PATHS = new String[] {
  GITHUB + "/src",
  GITHUB + "/doc"
};

int    SAMPLES_PER_CHUNK = 3;
int    MAX_CHUNK_SIZE    = 2000;
String LLM_MODEL         = "gpt-4o-mini";
long   MAX_FILE_SIZE     = 100000;
String RUN_KEY           = "my-dataset-2026-01-01"; // change to start fresh

// Replace internal identifiers before they reach the LLM
String[] ANON_PATTERNS = new String[] {
  "MyCompany",  "Example",
  "mycompany",  "example",
  "com.myco",   "com.example"
};

// Option A — balanced sample: n files per category from the full crawl
int MAX_PER_CATEGORY = 3;

// Option B — curated set: exact files in order; good for prompt tuning
String[] ITEMS = new String[] {
  GITHUB + "/src/foam/dao/MyDAO.js",       // js
  GITHUB + "/src/com/myapp/MyService.java", // java
  GITHUB + "/journals/services.jrl",        // jrl
  GITHUB + "/doc/guide.md"                  // markdown
};

FileCrawler crawler = new FileCrawler(x);
crawler.setSourcePaths(SOURCE_PATHS);
crawler.setFileExtensions(new String[] { ".js", ".java", ".jrl", ".md" });
crawler.setMaxFileSize(MAX_FILE_SIZE);

MyDatasetGenerator delegate = new MyDatasetGenerator(x);
delegate.setCrawler(crawler);
delegate.setSamplesPerChunk(SAMPLES_PER_CHUNK);
delegate.setMaxChunkSize(MAX_CHUNK_SIZE);
delegate.setLlmModel(LLM_MODEL);
delegate.setAnonymizePatterns(ANON_PATTERNS);
// ── mode switch ──────────────────────────────────────────────────────────────
delegate.setItems(ITEMS);                        // curated list — start here
// delegate.setMaxPerCategory(MAX_PER_CATEGORY); // balanced sample — next step
// (remove both lines for a full production run)

BatchJob job = new BatchJob(x);
job.setDelegate(delegate);
job.setRunKey(RUN_KEY);

((DAO) x.get("jobDAO")).put(job);
print("Job submitted. Track progress in Workspace → Jobs.");
```

Then register the script in a `.jrl` journal:

```jrl
p({
  "class": "foam.core.script.Script",
  "id": "generate-my-dataset",
  "description": "Dataset generation from myproject source.",
  "server": true,
  "language": "BEANSHELL",
  "code": "... your script above ..."
})
```

### RUN_KEY and Resumability

`RUN_KEY` identifies a generation run. `BatchJob` records which items have been processed; if the job is interrupted it resumes from where it stopped on the next submission with the same key. Change `RUN_KEY` any time you want a clean slate — for example after changing prompts or chunking logic.

### Anonymization

`anonymizePatterns` is a flat `[find, replace, find, replace, ...]` array applied to each file's content before it reaches the LLM. Set it in the run script. Do not commit sensitive identifiers to source control.

## Monitoring the Job

Once the job is submitted, navigate to `jobDAO` to track it. Each `BatchJob` appears there with live status and an output panel that shows a line per processed file and the number of samples stored — enough to tell immediately whether each category is producing results.

While a job is running you can **Suspend** it — the Suspend action is enabled only when the job status is Running. The job finishes its current item, checkpoints its position, and stops cleanly. Resubmit the same script with the same `RUN_KEY` to resume from where it left off. This is useful if you spot a problem early — suspend, fix the prompt, bump `RUN_KEY`, and restart rather than waiting for the full run to finish.

## Viewing Samples

There is a handy `AlpacaSampleBrowseView` screen for browsing and reviewing generated samples — it is not wired up by default, so you will need to add a menu entry pointing at `datasetDAO`. In a `.jrl` journal:

```jrl
p({
  "class": "foam.core.menu.Menu",
  "id": "workspace.dataset",
  "parent": "workspace",
  "label": "Dataset",
  "order": 3,
  "authenticate": true,
  "handler": {
    "class": "foam.core.menu.DAOMenu2",
    "config": {
      "class": "foam.comics.v2.DAOControllerConfig",
      "daoKey": "datasetDAO",
      "summaryView": { "class": "foam.ai.dataset.AlpacaSampleBrowseView" }
    }
  }
})
```

`AlpacaSampleBrowseView` renders each sample as an inline editable row with instruction, input, and output fields. You can edit samples directly in the browser and save them back to the DAO. A **Reviewed** action marks a sample as checked — useful for tracking which samples have been validated before a fine-tuning run. **Delete** removes samples that slipped through the prompt filters.

The `relevance` field is worth paying attention to: it is incremented automatically each time the deduplication rule sees a new sample whose instruction is semantically similar to this one. A high relevance score means the same training pattern was generated repeatedly across multiple source files — a signal that the pattern is important and that this sample is a strong representative to keep.

## Semantic Deduplication

The SHA-256 hash catches exact duplicates — identical instruction and output text. Semantic deduplication goes further: every new sample is embedded and compared against all existing embeddings using cosine similarity. If the nearest neighbor scores above **0.92**, the incoming sample is vetoed before it is stored and the original sample's `relevance` counter is incremented instead.

This is handled automatically by a ruler rule that fires on every `put` to `datasetDAO`. You do not need to call it yourself. What you do need is `embeddingService` and `vectorStoreDAO` in context — if either is absent the rule logs a warning and lets the sample through with status `NEW` rather than failing the run.

The sample `status` field tracks this lifecycle:

| Status | Meaning |
|---|---|
| `NEW` | Created but not yet embedded — `embeddingService` or `vectorStoreDAO` was unavailable |
| `CREATED` | Embedded and indexed in `vectorStoreDAO`; passed the similarity check |
| `DISCARDED` | Deleted without an embedding — marked rather than hard-deleted to preserve the audit trail |

A sample vetoed by the similarity check never reaches the DAO at all — it is thrown as a `RuntimeException` by the rule. What you will see in the job output is a stored-sample count lower than `samplesPerChunk × chunks`; the gap is the deduplicated ones.

The 0.92 threshold is conservative by design. Instructions that teach the same FOAM pattern from slightly different angles are useful; near-identical phrasings are not. If you find the threshold too aggressive for your content — for example, `.jrl` entries that are structurally similar by nature — you can adjust it in `AlpacaSampleCreateRuleAction.SIMILARITY_THRESHOLD`.

See [VectorSearch.md](VectorSearch.md) for how `EmbeddingService` and `VectorStoreDAO` work.

## Quality Checklist

Before committing a dataset for a fine-tuning run:

- [ ] Every instruction is domain-neutral — no company names, class names, or service names
- [ ] Every instruction contains the category label your prompt requires
- [ ] Every output contains working code (no prose-only samples slipped through)
- [ ] A representative sample from each category has been reviewed in the dataset browser
- [ ] `RUN_KEY` was changed before the final run so the dataset reflects the current prompts
- [ ] `ANON_PATTERNS` covers all internal identifiers that should not appear in training data
