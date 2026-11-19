<!-- cspell:ignore spid embeddingService vectorStoreDAO noteDAO EasyDAO isEmbeddable toIndexText embeddingSync textsPerCall embedOnSave Ollama -->
<flow name="Embeddings" category="DOC/GUIDE" spid="foam" description="Make a model searchable by meaning: opt the model in with EmbeddingAware, leave records out, and check the chunks appear in vectorStoreDAO." keywords="vector,embedding,EmbeddingAware,EmbeddingAwareDAO"/>

# Embeddings: Make a Model Searchable by Meaning

> **Builds on:** [Vector Search](VectorSearch.md) · [EasyDAO](EasyDao.md)

Your model implements one interface. From then on, every record you save is marked, then embedded in the background and stored in `vectorStoreDAO`, ready for a vector search.

## Before you start

An embedding provider behind the `embeddingService` CSpec. Ollama is the default and needs no key. See [Vector Search](VectorSearch.md) to switch provider.

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

That is all. Keep `noteDAO` a plain `EasyDAO`: it sees the interface and adds `EmbeddingAwareDAO`. A save marks the note and makes no AI call, so it never waits on the provider. The `embeddingSync` service then embeds the marked notes in the background. Removing a note removes its chunks.

`embeddingStatus` says where a note is:

| Status | Meaning |
|---|---|
| `NEW` | Never embedded since it was created or the server started. |
| `EMBEDDED` | Its chunks hold its current text. |
| `DIRTY` | Its text changed since its chunks were made. |
| `DISCARDED` | `isEmbeddable` is false, so it has no chunks. |

A save that leaves `toIndexText` as it was, e.g. one that only sets a flag, keeps the status. The status is kept in memory only: after a restart every note is `NEW` again, and the first sync finds its stored chunks unchanged and makes no AI call.

## Step 2 (optional): leave records out

Write `isEmbeddable(x)` when some records must not be searched, e.g. return `false` for a draft. The default is every record. A record that turns `false` loses its chunks.

## Step 3: check it works

1. Save a note.
2. Within a few seconds its `embeddingStatus` reads `EMBEDDED`, and `vectorStoreDAO` holds one row per chunk of the note, with ids like `noteDAO:42:0`, `noteDAO:42:1`.
3. Edit the note's body. The status turns `DIRTY`, then `EMBEDDED` again, and the rows hold the new text and none holds the old.

## Change the defaults

| To change | Override | Default |
|---|---|---|
| How often the fallback sync runs | The `embeddingSync` row in `src/foam/core/ai/cronjobs.jrl` | Every 30 minutes |
| Embed on save | `embedOnSave` of the `embeddingSync` CSpec. Off: only the cron embeds. | On |
| Chunks per AI call | `textsPerCall` of the `embeddingSync` CSpec | 64 |

A server embeds up to `textsPerCall` chunks of as many records as it takes in one call, so a million records cost tens of thousands of round trips, not a million. The first sync after a start also removes the chunks of records that are gone, e.g. dropped from a journal while the server was down.

## When something is off

| You see | Why | Do |
|---|---|---|
| A note stays `NEW` or `DIRTY` | The provider is down or not set up. The log has an "Embedding sync stopped" warning. | Fix the provider. The next sync, at the latest the cron, embeds it. |
| One note stays `NEW` while the others are `EMBEDDED` | The provider refuses its text. The log names it. | Change its text. |
| Search misses notes after you change the embedding provider or model | Vectors of two models do not match, and a sync compares chunk text only, so it keeps the old vectors. | Clear `vectorStoreDAO`. The next sync finds no chunks and embeds every note again. |

A server with no embedding provider configured skips indexing and never fails a save.
