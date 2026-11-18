<!-- cspell:ignore spid daoKey daoKeys sourceId embeddingModel storageTransient CosineComparator kNN Ollama Xenova Chunker chunker ragService llmService embeddingService vectorStoreDAO noteDAO docDAO EasyDAO nSpec isEmbeddable toIndexText openIndexed embeddingSync batchSize MDAO MiniLM Qwen cronjobs -->
<flow name="Embeddings" category="DOC/GUIDE" spid="foam" description="How a model opts in to embeddings with EmbeddingAware, how the status lifecycle and EmbeddingSync keep its vectors current, and how ragService answers questions from the records a user can read, on a server or in the browser." keywords="vector,embedding,rag,EmbeddingAware,EmbeddingStatus,EmbeddingSync,ragService,ReadableSourcePredicate"/>

# Embeddings: Keep Any Model Searchable by Meaning

> **New to FOAM?** Start with the [FOAM Tutorial](../tutorials/foam-tutorial.md) or the [Introduction for Developers](Intro.md).  
> **Builds on:** [Vector Search](VectorSearch.md) · [EasyDAO](EasyDao.md) · [NanoServices](NanoServices.md) · [Credential Management](CredentialManagement.md)  
> **Opens up:** [LLM Services](LLM.md) · [Dataset Generation](DatasetGeneration.md)  
> You can follow this guide without reading those first. If something in the Builds On list is unfamiliar, follow the link before continuing.

A model implements one interface. The framework then keeps an embedding of each record up to date, and `ragService` answers questions from the records the asking user can read.

## 1. The problem it solves

An app keeps notes in `noteDAO`. A user asks "how do I reset my password?". The note that answers it is titled "Account recovery" and never uses the word "password".

Vector search finds it by meaning ([Vector Search](VectorSearch.md) explains how). But the vectors have to follow the notes:

- a new note needs vectors;
- an edited note needs new vectors, and the old ones must go;
- a deleted note must leave the index;
- a note the user cannot read must never feed an answer.

Without help, each app writes this itself: a rule or a button to index, a "has it changed?" check, and an access check at search time. `EmbeddingAware` does it once, in the framework.

## 2. Opting in: one step

Implement `foam.ai.vector.EmbeddingAware` and write `toIndexText`, the text a reader of the record sees.

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'Note',
  implements: [ 'foam.ai.vector.EmbeddingAware' ],

  properties: [ 'id', 'title', 'body' ],

  methods: [
    {
      // The text to embed: what a reader of the note sees
      name: 'toIndexText',
      code: function(x) { return '# ' + this.title + '\n\n' + this.body; },
      javaCode: 'return "# " + getTitle() + "\\n\\n" + getBody();'
    }
  ]
});
```

`noteDAO` stays a plain `EasyDAO`. Nothing else is added.

What you don't write:

- no hash field and no "has it changed?" check;
- no rule row on the DAO;
- no list of DAOs to sync;
- no nSpec flag, because `EasyDAO` sees the interface;
- no chunking, chunk ids or retry code.

Two optional methods:

| Method | Default | Write it when |
|---|---|---|
| `isEmbeddable(x)` | `true` (Java default method; a browser model without it counts as `true`) | Some records must stay out of the index, e.g. a draft or a private note. |
| `openIndexed(x)` | None | An answer's source link should open the record, e.g. in its detail view. |

foam3's own `Flow` opts in this way. `FlowEmbeddingAwareRefinement` makes a flow embeddable when its keywords hold `knowledge`, and its text is the flow's name, description and markdown.

## 3. The status lifecycle

Each record carries `embeddingStatus`. A save only sets the status: it is fast and calls no AI. `EmbeddingSync` reads the status later and does the slow work.

```mermaid
stateDiagram-v2
  [*] --> NEW: first save, isEmbeddable true
  [*] --> DISCARDED: first save, isEmbeddable false
  NEW --> EMBEDDED: sync (no AI call when the stored chunks already match)
  EMBEDDED --> DIRTY: save changes toIndexText
  DIRTY --> EMBEDDED: sync embeds again
  NEW --> DISCARDED: save with isEmbeddable false, chunks removed at once
  EMBEDDED --> DISCARDED: save with isEmbeddable false, chunks removed at once
  DIRTY --> DISCARDED: save with isEmbeddable false, chunks removed at once
  DISCARDED --> DIRTY: save makes it embeddable again
```

| Status | Means | What the sync does |
|---|---|---|
| `NEW` | Never embedded since it was created or the server started. | Embeds it. When the stored chunks already hold its text, it only sets `EMBEDDED`. |
| `EMBEDDED` | Its chunks hold its current text. | Nothing. |
| `DIRTY` | Its text changed since its chunks were made. | Embeds it again and replaces every old chunk. |
| `DISCARDED` | It does not want to be searched, so it has no chunks. | Nothing. The save that set it already removed the chunks. |

A few cases follow from these rules:

- **A save that leaves `toIndexText` as it was** keeps the status, e.g. a save that only moves a field the text does not show.
- **A remove** deletes the record and its chunks in the same call, with no AI call. Remove is not a status.
- **A record edited while the sync embeds it** keeps its new status, so the next sync embeds the new text.
- **A record removed or discarded while the sync embeds it** loses the chunks the sync just wrote.

## 4. Components

| Component | What it does | Why it exists | File |
|---|---|---|---|
| `EmbeddingAware` | The interface a model implements: `toIndexText`, `isEmbeddable`, `openIndexed`, and the `embeddingStatus` property. | The model says what text it has. Everything else reads that. | `src/foam/ai/vector/EmbeddingAware.js` |
| `EmbeddingStatus` | The enum `NEW`, `EMBEDDED`, `DIRTY`, `DISCARDED`. `embeddingStatus` is `storageTransient`: kept in memory only. | The save path and the sync share work through it, so a save never waits for an AI call. | `src/foam/ai/vector/EmbeddingAware.js` |
| `EmbeddingAwareDAO` | A `ProxyDAO`. A put compares old and new `toIndexText` and sets the status. A put that discards, a remove and a `removeAll` remove the chunks. `sync(x, limit)` embeds the DAO's `NEW` and `DIRTY` records and returns how many AI calls it made. | Marks what changed at the moment it changes, with no AI call, and owns the loop that embeds its records. | `src/foam/ai/vector/EmbeddingAwareDAO.js` |
| `EasyDAO.embeddingAware` | Adds `EmbeddingAwareDAO` when `of` implements `EmbeddingAware`, adds it to `embeddingSync`, and indexes `embeddingStatus`. In Java it sits below the rules and the other decorators. In the browser it is skipped for a `CLIENT` DAO, which leaves the work to the server's DAO. | Opting in needs no nSpec change, as `LifecycleAware` adds `LifecycleAwareDAO`. | `src/foam/dao/EasyDAO.js` |
| `EmbeddingSync` | Holds the `EmbeddingAwareDAO`s that EasyDAO built. `sync(x)` calls each one's `sync` until `batchSize` (50) AI calls are spent. On a server it is the `embeddingSync` service; in a browser an app exports one as `embeddingSync`. | No config lists the DAOs to sync, and one class runs the sync on a server and in a browser. | `src/foam/ai/vector/EmbeddingSync.js` |
| `embeddingSync` cron | Calls `embeddingSync.sync(x)` every 5 minutes. | Runs the slow, failure-prone AI calls off the save path. | `src/foam/core/ai/cronjobs.jrl` |
| `RAGIndexer` | `index` cuts `toIndexText` into chunks, embeds them in one `embedAll` call and replaces every chunk the record had. It returns `false`, with no call, when the stored chunks already hold these texts from the same embedding model. `remove` deletes a record's chunks. Chunk ids are `<daoKey>:<sourceId>:<n>`, e.g. `noteDAO:42:0`. | One place owns chunk ids, the "already embedded?" check and the "replace all old chunks" rule, so a shorter text leaves no stale chunk. | `src/foam/core/ai/vector/RAGIndexer.js` |
| Chunker | Splits markdown at `##` headings (`maxDepth` 2) and cuts long sections at 2,000 characters. Java: `MarkdownChunkerServiceImpl`. Browser: `ClientMarkdownChunkerService`. | One vector per section finds the passage that answers, where one vector per long record blurs topics. | `src/foam/core/ai/vector/MarkdownChunkerService.js`, `src/foam/ai/vector/ClientMarkdownChunkerService.js` |
| `EmbeddingService` | Turns text into vectors: `embed`, `embedAll`, `getModel`. Providers: Ollama (the default), OpenAI, Transformers in the browser. | The provider is a CSpec choice, not a code change. | `src/foam/ai/vector/EmbeddingService.js`, `src/foam/core/ai/vector/provider/` |
| `VectorEmbedding` | One chunk: `text`, `vector`, `embeddingModel`, `daoKey`, `sourceId`. | Links each vector to the record it came from, so search can check that record. | `src/foam/ai/vector/VectorEmbedding.js` |
| `VectorStoreDAO` | Holds the chunks and answers `orderBy(CosineComparator)` with a cosine scan over a packed `float[]`. | Fast exact kNN inside a normal DAO. | `src/foam/ai/vector/VectorStoreDAO.js` |
| `ReadableSourcePredicate` | True for a chunk whose record the asking user can find through that record's own DAO. Each record is looked up once per search. | The record's own access rules decide what a user can be answered from. | `src/foam/core/ai/vector/ReadableSourcePredicate.js` |
| `RAGService` / `ragService` | `ask(x, question, daoKeys, locale)` returns a `RAGAnswer`: the answer, whether it was answered, and its sources. The server version is `ServerRAGService`. | The prompt, the search and the model call run on the server, as the asking user. | `src/foam/ai/llm/RAGService.js`, `src/foam/core/ai/llm/ServerRAGService.js` |
| `llmService` | Writes the answer from the prompt `ragService` builds. | Any provider; see [LLM Services](LLM.md). | `src/foam/core/ai/services.jrl` |
| `RAGChat`, `RAGChatPanel` | The chat view. It calls `ragService.ask` and lists each answer's sources. A source link finds the record through the user's own DAO and calls `openIndexed`. | One view for both modes; only the `ragService` behind it changes. | `src/foam/ai/llm/RAGChat.js`, `src/foam/ai/llm/RAGChatPanel.js` |

## 5. Server mode

The picture first. Three lanes: save, sync, ask.

```mermaid
flowchart LR
  subgraph SAVE["Save: no AI call"]
    P["noteDAO.put(note)"] --> D["EmbeddingAwareDAO<br/>sets embeddingStatus"] --> S[("noteDAO storage")]
  end
  subgraph SYNC["Sync: the embeddingSync cron, every 5 minutes"]
    C["EmbeddingSync"] --> A["EmbeddingAwareDAO.sync"] --> I["RAGIndexer"] --> E["embeddingService"] --> V[("vectorStoreDAO")]
  end
  subgraph ASK["Ask: as the user"]
    Q["RAGChat"] --> R["ragService"] --> F["search, filtered by<br/>ReadableSourcePredicate"] --> L["llmService"]
  end
  S -.->|"NEW / DIRTY"| A
  V -.->|"chunks"| F
```

### Save: the status changes, nothing else

```mermaid
sequenceDiagram
  participant App
  participant Outer as rules and other decorators
  participant EA as EmbeddingAwareDAO
  participant Store as noteDAO storage
  participant Idx as RAGIndexer
  App->>Outer: put(note)
  Outer->>EA: put(note)
  EA->>Store: find the stored copy
  EA->>EA: compare old and new toIndexText, check isEmbeddable
  EA->>Store: put(note with NEW, DIRTY, DISCARDED or its old status)
  opt the put turned it DISCARDED
    EA->>Idx: remove its chunks, as the system
  end
  EA-->>App: saved note
```

The save makes no embedding call and does not wait. A provider that is down cannot fail a save.

The chunks are removed as the system because they are the index's own rows. A user who may edit a record needs no right on `vectorStoreDAO`.

### Sync: the cron embeds and stores

```mermaid
sequenceDiagram
  participant Cron as embeddingSync cron
  participant Sync as EmbeddingSync
  participant EA as EmbeddingAwareDAO
  participant Idx as RAGIndexer
  participant Emb as embeddingService
  participant VS as vectorStoreDAO
  Cron->>Sync: sync(x)
  loop each registered DAO, while the budget of 50 calls lasts
    Sync->>EA: sync(x, budget left)
    EA->>EA: select NEW and DIRTY
    loop each record, until the budget is spent
      EA->>Idx: index(x, "noteDAO", note)
      Idx->>VS: stored chunks hold these texts and this model?
      alt yes
        Idx-->>EA: false, no AI call
      else no
        Idx->>Emb: embedAll(chunks)
        Emb-->>Idx: vectors
        Idx->>VS: remove old chunks, put new chunks
        Idx-->>EA: true, one AI call
      end
      EA->>EA: put(note with EMBEDDED), below the rules
    end
    Note over Sync,EA: one failed call skips that record, two in a row stop the run
    EA-->>Sync: AI calls made
  end
```

The cron runs as the system, so it reads every opted-in record. The access check happens when someone asks, not here.

The status write goes to the decorator's own delegate, below the rules and the last-modified stamp. Since the status is not stored, it adds no journal line, no history row and no new last-modified date.

When `embedAll` fails, the record keeps its old chunks and its status, and the sync tries the next record that needs a call:

- **the next call works:** only the first record was refused. One warning names the DAO and the record id, and the run goes on;
- **the next call fails too:** the provider is down. The run stops with one warning that names the DAO. An app with no embedding provider makes 2 calls and logs 1 warning every 5 minutes.

Either way the next run retries the failed records. Each failed call counts against the run's 50 calls.

### Boot: records from a journal or a seed

`embeddingStatus` is not stored, so every record loaded at boot is `NEW`. An app can ship a seed file of `VectorEmbedding` rows beside its records.

```mermaid
sequenceDiagram
  participant Sync as EmbeddingSync
  participant EA as EmbeddingAwareDAO
  participant Idx as RAGIndexer
  participant VS as vectorStoreDAO
  Sync->>EA: sync(x, 50)
  EA->>Idx: index(x, "noteDAO", note)
  Idx->>Idx: chunk toIndexText
  Idx->>VS: find noteDAO:42:0, noteDAO:42:1, ...
  alt same texts, same count, same embedding model
    Idx-->>EA: false, no AI call
  else a text differs, a chunk is missing or extra, or another model
    Idx->>Idx: embed as for DIRTY
  end
  EA->>EA: put(note with EMBEDDED)
```

A server that boots with a matching seed makes no embedding call at all. A record that needs no call costs no budget, so one run can mark every unchanged record `EMBEDDED`.

### Ask: one call from the browser

```mermaid
sequenceDiagram
  participant UI as RAGChat (browser)
  participant RS as ragService (server)
  participant Emb as embeddingService
  participant VS as vectorStoreDAO
  participant P as ReadableSourcePredicate
  participant LLM as llmService
  UI->>RS: ask(question, ["noteDAO"], "fr")
  RS->>Emb: embed(question)
  RS->>VS: nearest 10 chunks of noteDAO, same model, as the user
  VS->>P: is this chunk's record readable?
  P->>P: noteDAO.inX(user x).find(sourceId) != null
  VS-->>RS: readable chunks, best score first
  alt no chunk scores 0.25 or more
    RS-->>UI: not answered, no model call
  else
    RS->>LLM: complete(system prompt + documents + question)
    LLM-->>RS: answer, or NO_ANSWER
    RS-->>UI: answer + the sources it names (or the 3 closest on NO_ANSWER)
  end
```

Details from `ServerRAGService`:

- a question is cut at 2,000 characters (`maxQuestionChars`);
- the documents sent to the model stop at 18,000 characters (`contextChars`);
- the answer is written in the language of `locale`, e.g. French for `fr`;
- a chunk below `minScore` (0.25) is neither sent nor offered as a source, so an unrelated question costs no model call.

The browser never sees the system prompt or the provider's API key. `llmService` stays served for features that call a model directly; the chat view calls only `ragService`.

## 6. Client-only mode

The same `Note` model runs with no server, e.g. a demo page with browser models. After the first model download, nothing leaves the browser.

```mermaid
flowchart LR
  P["page: noteDAO.put(note)"]
  D["EmbeddingAwareDAO (JS)"]
  M[("noteDAO, MDAO")]
  S["EmbeddingSync<br/>exported as embeddingSync"]
  C["RAGIndexer<br/>ClientMarkdownChunkerService"]
  E["embedder in a Web Worker<br/>all-MiniLM-L6-v2, batches of 8"]
  V[("chunk store, MDAO")]
  Q["RAGChat"]
  R["the page as ragService<br/>cosine top 5"]
  L["text generator in a Web Worker<br/>Qwen3-0.6B, thinking off"]
  P -->|"note"| D
  D -->|"note + status"| M
  M -.->|"change event, 1 s later"| S
  S --> C
  C -->|"chunk text"| E
  E -->|"384-number vector"| V
  Q -->|"question"| R
  V -->|"top 5 passages"| R
  R -->|"passages + this question,<br/>no chat history"| L
  L -->|"words as they are written"| Q
```

The page does three things:

- **exports an `EmbeddingSync` as `embeddingSync`.** Each EasyDAO built in its context adds its DAO, and a burst of saves costs one sync a second later;
- **exports its embedder as `embeddingService` and a DAO of `VectorEmbedding` as `vectorStoreDAO`.** `RAGIndexer` reads both from the context. The demo uses a plain MDAO: `VectorStoreDAO`'s packed index runs only on a server, and a few hundred chunks sort by `CosineComparator` fast enough in the page;
- **implements `RAGService` and exports itself as `ragService`,** so `RAGChat` is the same view as on the server.

`foam.ai.demos.RAGChatPage` does all three. Its **Index Knowledge Flows** button copies the knowledge flows into an EasyDAO in the page, and the page's `EmbeddingSync` embeds them with the provider picked on the page.

| Piece | Server mode | Client-only mode |
|---|---|---|
| Your model | Implements `EmbeddingAware`, writes `toIndexText` | The same |
| Marks changes | `EmbeddingAwareDAO`, Java | `EmbeddingAwareDAO`, JS |
| Runs the sync | The `embeddingSync` cron, every 5 minutes | The same `EmbeddingSync` class, 1 second after a change |
| Spots unchanged chunks | Same texts and same embedding model | Same texts and same embedding model |
| Makes vectors | `embeddingService`, any provider | `TransformersEmbeddingService` (`Xenova/all-MiniLM-L6-v2`), in a Web Worker on WebGPU, else WebAssembly |
| Stores vectors | `vectorStoreDAO` on the server | An MDAO in the page |
| Writes answers | `llmService` | `TransformersLLMService` (`onnx-community/Qwen3-0.6B-ONNX`), in a Web Worker, word by word into `RAGChat.partial`. Each question goes alone with its 5 nearest passages and no chat history, and the model's thinking step is off (`enable_thinking: false`) |
| Who sees what | Only records the asking user can read | Whatever the page holds |

Both models run in a Web Worker, so the page stays responsive while they work. The first use downloads transformers.js 4.3.2 from jsDelivr and the model weights from Hugging Face, then the browser caches them. The models are small: they suit a demo and are slower and weaker than a server model.

Another embedding model needs no code change. Set `model`, `pooling` and `queryPrefix` of `TransformersEmbeddingService` together, since all three belong to the model. For example, `Snowflake/snowflake-arctic-embed-xs` takes pooling `cls` and a question prefix.

## 7. Design choices and their costs

| Choice | What it gives | What it costs |
|---|---|---|
| No stored hash: `RAGIndexer` compares chunk texts | No extra field on the model or on `VectorEmbedding`, and seed files carry no hash. | Each `NEW` or `DIRTY` record is chunked again and its stored chunks are read. That makes no AI call. |
| `embeddingStatus` is not stored (`storageTransient`) | The sync's status writes add no journal line. | After a restart every record is `NEW`, and the first sync makes one text-compare pass over all of them. |
| The decorator sits below the rules | The sync's status write runs no rule, adds no history row and keeps the last-modified date. | A rule cannot react to a record turning `EMBEDDED`. |
| Remove is a hard remove | Remove keeps its usual meaning on every model that opts in. | A record added again is embedded again. A soft delete to `DISCARDED` would change what remove means on every model that opts in. |
| The save path makes no AI call | Saves stay fast, and a provider outage fails no save. | An edit is searchable after the next cron run, up to 5 minutes later. |
| 50 AI calls per run | One run stays short. | Re-embedding 500 records takes 10 runs, about 50 minutes. |
| Two failed calls in a row stop the run | A provider that is down, or not set up, costs 2 calls and 1 warning per run. A single record the provider refuses is skipped with a warning. | A refused record is tried again on every run and logs a warning each time. Two refused records in a row look like an outage and stop the run. |
| DAOs add themselves when EasyDAO builds them | No list of DAOs to keep in step with the code. | A DAO built lazily, on first use, joins the sync only then. Its records are embedded from that point on. |
| Access is checked at ask time | One index serves every user; the record's own DAO decides. | Each search finds the record of every candidate chunk, once per record. |

## 8. Configuring

### Swap the embedding provider

`embeddingService` is a CSpec in `src/foam/core/ai/services.jrl`. Ollama is the default and needs no credential. To use OpenAI, an app overrides the CSpec's `serviceScript`:

```javascript
p({
  "class": "foam.core.boot.CSpec",
  "name": "embeddingService",
  "serviceScript": """
    return new foam.core.ai.vector.provider.OpenAIEmbeddingServiceImpl(x);
  """
})
```

The OpenAI provider reads the credential `foam/llm/openai` from `credentialDAO` (`src/foam/core/ai/vector/provider/OpenAIEmbeddingService.js:31`). The credential rows are in `src/foam/core/ai/credentials.jrl`, and [Credential Management](CredentialManagement.md) explains the vault.

Vectors of one model match no question embedded by another, and `VectorEmbedding.embeddingModel` keeps them apart. `RAGIndexer` treats chunks from another model as changed. After a restart every record is `NEW`, so the syncs after a provider change embed every record again, 50 per run.

### Tune the sync

| Setting | Where | Default |
|---|---|---|
| How often the sync runs | The `Cron` row `embeddingSync` in `src/foam/core/ai/cronjobs.jrl` | Every 5 minutes |
| AI calls per run | `batchSize` of the `embeddingSync` service in `src/foam/core/ai/services.jrl` | 50 |

An app changes `batchSize` by overriding the `embeddingSync` CSpec, e.g. `new foam.ai.vector.EmbeddingSync.Builder(x).setBatchSize(20).build()`.

### Tune the answers

`ragService` is a CSpec too. An app can replace it with a subclass of `ServerRAGService`:

| Property or method | Default | Change it when |
|---|---|---|
| `systemPrompt` | Answer from the documents only, cite them, reply `NO_ANSWER` when they hold no answer | Your answers need another tone or format. |
| `options(x)` | Builds `LLMOptions` from `systemPrompt` and `maxTokens` | The prompt comes from configuration. |
| `minScore` | 0.25 | You change the embedding model. Scores differ by model. |
| `retrievalLimit` | 10 | More or fewer chunks should be read. |
| `contextChars` | 18,000 | The model's context window is smaller or larger. |
| `llmService` | Claude, with logging and PM decorators | See [LLM Services](LLM.md). |
