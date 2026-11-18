<!-- cspell:ignore spid daoKeys ragService llmService embeddingService vectorStoreDAO noteDAO EasyDAO isEmbeddable toIndexText openIndexed embeddingSync textsPerCall embedOnSave Ollama MDAO -->
<flow name="Embeddings" category="DOC/GUIDE" spid="foam" description="Make a model searchable by meaning and answer questions from it with Ask AI: opt the model in, add the chat, check it works, and change the defaults." keywords="vector,embedding,rag,EmbeddingAware,ragService,ask ai"/>

# Embeddings: Make a Model Searchable with Ask AI

> **Builds on:** [Vector Search](VectorSearch.md) · [EasyDAO](EasyDao.md) · [LLM Services](LLM.md)  
> **How it works inside:** [Embeddings design](../architecture/Embeddings.md)

Your model implements one interface. From then on, every record you save is embedded in the background, and a chat answers questions from the records each user can read.

## Before you start

- **An embedding provider.** Ollama is the default and needs no key. For OpenAI, see [Change the defaults](#change-the-defaults).
- **An `llmService`** to write the answers. See [LLM Services](LLM.md).

## Step 1: opt the model in

Implement `foam.ai.vector.EmbeddingAware` and write `toIndexText`: the text a reader of the record sees.

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'Note',
  implements: [ 'foam.ai.vector.EmbeddingAware' ],

  properties: [ 'id', 'title', 'body' ],

  methods: [
    {
      name: 'toIndexText',
      code: function(x) { return '# ' + this.title + '\n\n' + this.body; },
      javaCode: 'return "# " + getTitle() + "\\n\\n" + getBody();'
    }
  ]
});
```

That is all. Keep `noteDAO` a plain `EasyDAO`: it sees the interface and keeps the embeddings in sync. You write no rule, no hash, no DAO list and no nSpec flag.

## Step 2 (optional): leave records out, open sources

| Method | Write it when | Example |
|---|---|---|
| `isEmbeddable(x)` | Some records must not be searched. Default: every record. | Return `false` for a draft. |
| `openIndexed(x)` | A source link under an answer should open the record. | Push the record's detail view. |

## Step 3: add the chat

Add a menu that opens `RAGChatPanel` and name the DAOs it answers from:

```javascript
p({
  "class": "foam.core.menu.Menu",
  "id": "notesAsk",
  "label": "Ask AI",
  "handler": {
    "class": "foam.u2.dock.DockMenu",
    "view": { "class": "foam.ai.llm.RAGChatPanel", "daoKeys": ["noteDAO"] }
  }
})
```

The user needs `service.ragService` to ask. Each user is answered only from the notes they can open in `noteDAO`.

## Step 4: check it works

1. Save a note.
2. Within a few seconds its `embeddingStatus` reads `EMBEDDED`.
3. Open **Ask AI** and ask about the note in your own words. The answer lists the note as a source.

## Try it with no server

Open the **SimilaritySearch** flow and go to its **RAG Chat** section. It runs the same pieces in the browser, with models on WebGPU, and needs no key. The first use downloads the models, then the browser caches them.

To do the same in your own page, export these four from it:

- `embeddingSync`: an `EmbeddingSync`;
- `embeddingService`: an embedder, e.g. `TransformersEmbeddingService`;
- `vectorStoreDAO`: a DAO of `VectorEmbedding`, e.g. an MDAO;
- `ragService`: the page itself, implementing `RAGService`.

`foam.ai.demos.RAGChatPage` is a worked example.

## Change the defaults

| To change | Override | Default |
|---|---|---|
| The embedding provider | The `embeddingService` CSpec in `src/foam/core/ai/services.jrl`, e.g. `new foam.core.ai.vector.provider.OpenAIEmbeddingServiceImpl(x)`. OpenAI reads its key from the credential `foam/llm/openai` ([Credential Management](CredentialManagement.md)). | Ollama |
| How often the fallback sync runs | The `embeddingSync` row in `src/foam/core/ai/cronjobs.jrl` | Every 30 minutes |
| Embed on save | `embedOnSave` of the `embeddingSync` CSpec. Off: only the cron embeds. | On |
| Chunks per AI call | `textsPerCall` of the `embeddingSync` CSpec | 64 |
| The answer's tone or format | `systemPrompt` of a `ServerRAGService` subclass, set as the `ragService` CSpec | Answer from the documents only, cite them |
| How close a passage must be | `minScore` of the same subclass. Change it with the embedding model. | 0.25 |

## When something is off

| You see | Why | Do |
|---|---|---|
| A record stays `NEW` or `DIRTY` | The provider is down or not set up. The log has an "Embedding sync stopped" warning. | Fix the provider. The next sync, at the latest the cron, embeds it. |
| A record is never found | `isEmbeddable` returned false, or the user cannot open it in its DAO. | Check both. |
| "Not answered" for a fair question | No passage scored 0.25 or more. | Reword `toIndexText` to hold the words a reader uses, or lower `minScore`. |
| Every record is embedded again after a deploy | The embedding provider or model changed. Vectors of two models do not match. | Expected, once. |
