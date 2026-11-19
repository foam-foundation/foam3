<!-- cspell:ignore spid embeddingService vectorStoreDAO noteDAO EasyDAO isEmbeddable toIndexText openIndexed Ollama -->
<flow name="Embeddings" category="DOC/GUIDE" spid="foam" description="Make a model searchable by meaning: opt the model in with EmbeddingAware, leave records out, and check the chunks appear in vectorStoreDAO." keywords="vector,embedding,EmbeddingAware,EmbeddingAwareDAO"/>

# Embeddings: Make a Model Searchable by Meaning

> **Builds on:** [Vector Search](VectorSearch.md) · [EasyDAO](EasyDao.md)

Your model implements one interface. From then on, every record you save is embedded in the background and stored in `vectorStoreDAO`, ready for a vector search.

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

That is all. Keep `noteDAO` a plain `EasyDAO`: it sees the interface and adds `EmbeddingAwareDAO`. A save stores the note first, then embeds it in the background, so the save never waits on the provider. A save that leaves `toIndexText` as it was, e.g. one that only sets a flag, makes no call. Removing a note removes its chunks.

## Step 2 (optional): leave records out, open sources

| Method | Write it when | Example |
|---|---|---|
| `isEmbeddable(x)` | Some records must not be searched. Default: every record. | Return `false` for a draft. A record that turns `false` loses its chunks. |
| `openIndexed(x)` | A link to a search result should open the record. | Push the record's detail view. |

## Step 3: check it works

1. Save a note.
2. Within a few seconds, open `vectorStoreDAO`. It holds one row per chunk of the note, with ids like `noteDAO:42:0`, `noteDAO:42:1`.
3. Edit the note's body. The rows now hold the new text, and none holds the old.

If no rows appear, the log holds an "Embedding failed" warning from the provider. The note is stored either way, and is embedded again the next time its text changes.
