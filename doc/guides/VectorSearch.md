<flow name="VectorSearch" category="DOC/GUIDE" spid="foam" description="Covers vector search and similarity search in FOAM: embeddings, kNN, scoring, VectorEmbedding model, EmbeddingService interface, provider pattern, VectorStoreDAO, and CosineComparator." keywords="vector,search,similarity,embedding,knn,cosine,rag,VectorStoreDAO,EmbeddingService,knowledge"/>

# Vector Search: From Content to Scored Results

Vector search finds items by meaning rather than exact wording. Content and queries are converted into numeric vectors (embeddings), and results are ranked by how close their vectors sit to the query's vector. The process has four stages: vectorizing the content, vectorizing the query, running a kNN (k-nearest neighbors) search, and scoring the results.

## 1. Vectorizing the Content

The first step is to turn every piece of searchable content into an embedding. An embedding model, typically a transformer trained so that semantically similar text lands near each other, reads the text and outputs a fixed-length list of numbers, often somewhere between 384 and 3,072 dimensions. "Kittens love yarn" and "cats enjoy playing with string" end up close together even though they share almost no words.

Before embedding, long documents are usually split into chunks of a few hundred tokens, often with some overlap between neighboring chunks. Chunking matters because a single vector for a 50-page document blurs many topics together, while chunk-level vectors let the search pinpoint the passage that actually answers the question. Each chunk keeps a reference back to its source document and any useful metadata such as title, date, or category.

Vectors are commonly normalized to unit length at this stage. This simplifies scoring later, because on unit vectors the dot product equals cosine similarity.

The resulting vectors are stored in an index, which can be anything from an in-memory array to a dedicated vector database. This stage happens ahead of time and is repeated only when content is added or changed.

## 2. Vectorizing the Query

At search time, the user's query goes through the same embedding model used for the content. This is essential: each model defines its own vector space, and vectors from different models are not comparable. The query is normalized the same way as the content, producing a single query vector.

Some models are trained asymmetrically and expect a prefix or instruction to distinguish queries from documents (for example, marking one input as a "query" and the other as a "passage"). When a model works this way, following its convention noticeably improves results.

## 3. Executing the kNN Search

With a query vector in hand, the system looks for the k stored vectors closest to it.

**Exact (brute-force) kNN** compares the query against every vector in the index and keeps the top k. It always returns the true nearest neighbors, but its cost grows linearly with the collection size. It works well up to tens of thousands of vectors, and remains useful as a ground truth for evaluating faster methods.

**Approximate nearest neighbor (ANN)** search trades a small amount of accuracy for large speed gains on big collections. Common index structures include HNSW, a layered graph that is navigated greedily toward the query's neighborhood; IVF, which clusters vectors and searches only the clusters nearest the query; and product quantization, which compresses vectors to cut memory use. These indexes expose tuning knobs that balance recall against latency. Libraries such as FAISS and hnswlib, and databases such as pgvector, Qdrant, Milvus, Elasticsearch, and OpenSearch, provide them out of the box.

Searches are often combined with metadata filters, for example restricting results to a certain date range or document type. Filtering can be applied before the vector search (pre-filtering) or after it (post-filtering); pre-filtering is more precise, while post-filtering can return fewer than k results if many candidates are filtered out.

## 4. Scoring the Results

Each candidate receives a similarity or distance score relative to the query:

| Metric | Range | Better when | Notes |
|---|---|---|---|
| Cosine similarity | -1 to 1 | Higher | Measures the angle between vectors; the most common choice for text |
| Dot product | Unbounded | Higher | Equals cosine similarity on normalized vectors |
| Euclidean (L2) distance | 0 to ∞ | Lower | Gives the same ranking as cosine on normalized vectors |

The metric should match what the embedding model was trained with, which is usually stated in its documentation.

Results are returned sorted by score. Raw scores are relative rather than absolute, so a cosine of 0.5 may be a strong match for one model and a weak one for another. In practice, teams set a minimum score threshold, tuned on real queries, to drop weak matches instead of always returning k items.

Scoring can be refined further. **Hybrid search** blends vector similarity with keyword scores such as BM25, which helps with exact terms like product codes and names that embeddings can miss; the two ranked lists are often merged with reciprocal rank fusion. **Re-ranking** passes the top candidates to a cross-encoder model that reads the query and each result together, producing more accurate scores at higher cost, which is why it is applied only to a short list.

## 5. Retrieval-Augmented Generation (RAG)

Retrieval-augmented generation feeds the results of similarity search to a large language model (LLM) as context for writing an answer. An LLM on its own knows only what it saw in training, which has a cutoff date, excludes private documents, and can lead to invented answers. RAG fixes this by retrieving relevant material at question time, like an open-book exam.

The flow reuses everything above. Documents are chunked, embedded, and indexed ahead of time. At question time, the query is embedded and a kNN search returns the top-scoring chunks. Those chunks are inserted into the LLM's prompt with instructions to answer from them and cite sources, and the model generates a grounded answer.

Because the model can only use what retrieval gives it, the search layer largely determines answer quality. If the relevant chunk isn't retrieved, no model can recover it; irrelevant chunks dilute the context and can mislead the model; and k now means how much context the model receives, bounded by context window, cost, and latency. Low top scores can also signal the system to decline rather than guess. Common refinements include rewriting the query before embedding it, running several query variants and merging results, and letting the model search iteratively. RAG systems are best evaluated in two parts: whether retrieval surfaced the right chunks, and whether the answer stayed faithful to them.

## In a Nutshell

Content is chunked, embedded, and indexed ahead of time. At query time, the query is embedded with the same model, the index returns the nearest vectors through exact or approximate kNN, and the candidates are scored, thresholded, and optionally blended with keyword signals or re-ranked before being returned to the user. RAG extends this pipeline by passing the top results to an LLM as context, so the quality of the similarity search directly determines the quality of the generated answer.

## Similarity Search in FOAM

FOAM's vector search support is built around three layered abstractions: a data model for embeddings, a service interface for producing them, and a DAO that indexes and searches them.

### VectorEmbedding

`foam.ai.vector.VectorEmbedding` is the unit of storage. Each instance represents one embedded chunk of text:

| Property | Type | Purpose |
|---|---|---|
| `id` | String | Unique identifier (e.g. `"flowName:chunkIndex"`) |
| `text` | String | The original text that was embedded |
| `sourceId` | String | Where the chunk came from (doc path, class id, flow name, etc.) |
| `kind` | String | Category of source (`'flow'`, `'class'`, `'property'`, etc.) |
| `embeddingModel` | String | The model that produced the vector (e.g. `'Xenova/all-MiniLM-L6-v2'`) |
| `vector` | FloatArray | The embedding — a normalized `float[]` of fixed dimension |

The `embeddingModel` field is important: vectors from different models live in incompatible spaces and cannot be compared. At query time, results are filtered to embeddings that share the query's model name, so the index can safely hold vectors from multiple models side by side.

### EmbeddingService

`foam.ai.vector.EmbeddingService` is a FOAM interface that decouples calling code from any particular embedding backend:

```javascript
embed(x, text)      // → VectorEmbedding
embedAll(x, texts)  // → VectorEmbedding[]
```

The interface is declared with `skeleton: true` and `client: true`, so FOAM generates the server-side skeleton and client-side proxy automatically. An `EmbeddingService` can be called identically from JavaScript or Java, in-process or over the network.

### Providers

Because the interface is the only contract, the embedding backend is a configuration choice rather than a code dependency. Different providers can be registered in context and swapped without changing any calling code:

| Provider | Where it runs | Notes |
|---|---|---|
| `foam.ai.vector.provider.TransformersEmbeddingService` | Browser (WebAssembly) | Loads a sentence-transformer via [Transformers.js](https://huggingface.co/docs/transformers.js); no server required |
| *(server-side providers)* | Java server | Can call OpenAI, Ollama, Cohere, or any HTTP embedding API |

`TransformersEmbeddingService` defaults to `Xenova/all-MiniLM-L6-v2` (384 dimensions). The model name is a property — pointing it at a larger or domain-specific model requires only a configuration change, not a code change.

### Chunking

Before embedding, long documents are split into chunks. `MarkdownChunkParser` splits at heading boundaries (`maxDepth: 2` means each `##` section becomes one chunk). `ClientMarkdownChunkerService` wraps it, strips inline markup, and splits oversized sections on paragraph breaks to stay within the model's token limit.

### VectorStoreDAO and Search

`foam.ai.vector.VectorStoreDAO` is a `ProxyDAO` decorator that adds a flat `float[]` index over any backing DAO. Internally it packs all stored vectors into one contiguous array in row-major order, which keeps the cosine scan CPU-cache friendly. The index rebuilds lazily whenever the underlying data changes.

Search uses `foam.ai.vector.CosineComparator` as a standard `DAO.orderBy` comparator:

```javascript
var sink = await vectorStoreDAO
  .where(EQ(VectorEmbedding.EMBEDDING_MODEL, queryEmbedding.embeddingModel))
  .orderBy(CosineComparator.create({ queryVector: queryEmbedding.vector }))
  .limit(10)
  .select();
```

The `.where()` guard ensures query and stored vectors share the same model. Everything else — filtering, ranking, pagination — composes through the standard DAO API unchanged.

### To be Continued ...


