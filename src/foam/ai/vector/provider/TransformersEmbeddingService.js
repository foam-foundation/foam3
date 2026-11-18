/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector.provider',
  name: 'TransformersPipeline',

  documentation: `
    Runs one Transformers.js pipeline in a Web Worker, so a model that works for
    minutes, e.g. embedding 132 flows, never holds the page. The worker loads
    the library from the CDN and runs the model on the GPU when the browser has
    WebGPU, otherwise in WebAssembly. Its code is built here as a Blob URL, so
    there is no worker file to serve.
    Used by TransformersEmbeddingService and TransformersLLMService:
      pipeline.run(['some text'], { pooling: 'mean', normalize: true })
    resolves to what the pipeline returns, a tensor as nested arrays.
  `,

  constants: {
    // cspdirectives.jrl allows this URL and the ONNX runtime version the library loads:
    // a new version needs both changed, or the worker fails to start
    CDN:'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js'
  },

  properties: [
    {
      class: 'String',
      name: 'task',
      documentation: 'The Transformers.js task, e.g. "feature-extraction" or "text-generation".'
    },
    {
      class: 'String',
      name: 'model',
      documentation: 'The Hugging Face model id, e.g. "Xenova/all-MiniLM-L6-v2".'
    },
    {
      name: 'dtype',
      documentation: `The weights to load on each device, e.g. { gpu: 'fp32', wasm: 'q8' }.`
    },
    {
      class: 'Function',
      name: 'onProgress',
      documentation: `Called as the model downloads with how much of it is in, e.g. 35: one
        percent over all its files, weighted by their size, so a view needs no file names.`
    },
    {
      class: 'Function',
      name: 'onText',
      documentation: `Set on a text-generation pipeline to get the answer while the model writes
        it: called with each new piece of text, e.g. " the", so a view can show it word by word.`
    },
    {
      name: 'files_',
      documentation: 'The latest download report of each file of the model, by file name.',
      factory: function() { return {}; },
      hidden: true,
      transient: true
    },
    {
      name: 'worker_',
      hidden: true,
      transient: true
    },
    {
      name: 'calls_',
      documentation: 'The calls the worker has not answered yet, by id.',
      factory: function() { return {}; },
      hidden: true,
      transient: true
    },
    {
      class: 'Int',
      name: 'lastId_',
      hidden: true,
      transient: true
    },
    {
      name: 'loaded_',
      documentation: 'Resolves once the worker has the model loaded.',
      hidden: true,
      transient: true
    }
  ],

  methods: [
    function load() {
      if ( ! this.loaded_ ) {
        // a failed load, e.g. while offline, is tried again on the next call
        this.loaded_ = this.post_({ load: { task: this.task, model: this.model, dtype: this.dtype } })
          .catch(e => { this.loaded_ = null; throw e; });
      }
      return this.loaded_;
    },

    async function run(...args) {
      await this.load();
      return this.post_({ args: args, stream: !! this.onText });
    },

    function post_(msg) {
      if ( ! this.worker_ ) {
        var url = URL.createObjectURL(new Blob([ this.workerCode_() ], { type: 'text/javascript' }));
        this.worker_ = new Worker(url, { type: 'module' });
        this.worker_.onmessage = e => this.onMessage_(e.data);
        // the worker could not start, e.g. the CDN is unreachable: every waiting call fails
        this.worker_.onerror = e => {
          var calls = this.calls_;
          this.calls_  = {};
          this.worker_ = null;
          this.loaded_ = null; // a new worker starts with no model, so the next call loads it again
          var where = e.filename ? ' at ' + e.filename + ':' + e.lineno : '';
          for ( var id in calls ) calls[id].reject(new Error('Failed to start Transformers.js from ' + this.CDN + ': ' + ( e.message || 'worker error' ) + where));
        };
      }
      return new Promise((resolve, reject) => {
        var id = ++this.lastId_;
        this.calls_[id] = { resolve: resolve, reject: reject };
        this.worker_.postMessage(Object.assign({ id: id }, msg));
      });
    },

    function onMessage_(data) {
      if ( data.progress ) {
        // transformers.js reports each file apart, e.g. { status: 'progress', file: 'onnx/model.onnx',
        // loaded, total }; a file served with no size has total 0 and is left out of the sum
        var p = data.progress;
        if ( p.status === 'progress' && p.total && this.onProgress ) {
          this.files_[p.file] = p;
          var loaded = 0, total = 0;
          for ( var f in this.files_ ) { loaded += this.files_[f].loaded; total += this.files_[f].total; }
          this.onProgress(Math.floor(100 * loaded / total));
        }
        return;
      }
      if ( 'text' in data ) {
        this.onText(data.text);
        return;
      }
      var call = this.calls_[data.id];
      // the answer of a call already failed by onerror
      if ( ! call ) return;
      delete this.calls_[data.id];
      if ( data.error ) call.reject(new Error(data.error)); else call.resolve(data.result);
    },

    function workerCode_() {
      // The worker answers one message at a time: a model session runs one call at once.
      // A GPU that fails to run the model, e.g. a driver WebGPU does not support, falls back
      // to WebAssembly.
      // The library is loaded with import(), not an import statement: in a worker built
      // from a Blob URL, Chrome refuses a static import of the CDN file and the worker
      // fails to start with no message. The import is not awaited before onmessage is
      // set, or the first message, the one that loads the model, arrives with no listener
      // and is lost.
      // With its cache on, the library loads its ONNX runtime from a blob: URL, which the
      // page's script-src refuses ("Failed to fetch dynamically imported module: blob:…");
      // with it off, the runtime is imported from its CDN folder.
      // A streamed call adds a TextStreamer to its last argument, the generation options,
      // e.g. { max_new_tokens: 256 }: it posts each new piece of the answer as it is written.
      return `
        const lib = import('${this.CDN}').then(m => { m.env.useWasmCache = false; return m; });
        let pipe, queue = Promise.resolve();
        async function handle({ id, load, args, stream }) {
          try {
            if ( load ) {
              const { pipeline } = await lib;
              const gpu  = navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null);
              const make = device => pipeline(load.task, load.model, {
                device,
                dtype: load.dtype[device === 'wasm' ? 'wasm' : 'gpu'],
                progress_callback: progress => self.postMessage({ id, progress })
              });
              pipe = gpu ? await make('webgpu').catch(() => make('wasm')) : await make('wasm');
              self.postMessage({ id });
            } else {
              if ( stream ) {
                const { TextStreamer } = await lib;
                args.at(-1).streamer = new TextStreamer(pipe.tokenizer, {
                  skip_prompt: true,
                  skip_special_tokens: true,
                  callback_function: text => self.postMessage({ id, text })
                });
              }
              const out = await pipe(...args);
              self.postMessage({ id, result: out.tolist ? out.tolist() : out });
            }
          } catch ( e ) {
            self.postMessage({ id, error: String(e && e.message || e) });
          }
        }
        self.onmessage = e => { queue = queue.then(() => handle(e.data)); };
      `;
    }
  ]
});


foam.CLASS({
  package: 'foam.ai.vector.provider',
  name: 'TransformersEmbeddingService',
  implements: ['foam.ai.vector.EmbeddingService'],

  documentation: `
    Embeds text in the browser with a sentence-transformer, in a Web Worker so
    the page stays responsive. Any Hugging Face embedding model works: see model.
    The default, all-MiniLM-L6-v2, is a 90 MB download on a GPU and 23 MB
    without one, where it runs on 8-bit weights. snowflake-arctic-embed-xs found
    the right document more often (21 vs 19 of 22 questions) but chose longer
    passages, so the chat's answers took about 3 times longer and one went wrong.
  `,

  requires: [ 'foam.ai.vector.provider.TransformersPipeline' ],

  constants: [
    // Larger batches on WebGPU returned some NaN vectors, e.g. 1 of 43 chunks of one long
    // document, and 8 texts a run is also the fastest per text
    { name: 'BATCH_SIZE', value: 8 }
  ],

  messages: [
    { name: 'PREPARING',     message: 'Preparing…' },
    { name: 'GETTING_READY', message: 'Getting ready…' }
  ],

  properties: [
    {
      class: 'String',
      name: 'model',
      documentation: `The Hugging Face model id. Set it together with pooling and queryPrefix,
        which belong to the model, wherever the service is created: create() arguments or a
        service's nSpec. Another model needs no code change, e.g. snowflake-arctic-embed-xs is
        { model: 'Snowflake/snowflake-arctic-embed-xs', pooling: 'cls',
          queryPrefix: 'Represent this sentence for searching relevant passages: ' }.`,
      value: 'Xenova/all-MiniLM-L6-v2'
    },
    {
      class: 'String',
      name: 'pooling',
      documentation: `How the model's per-word output becomes one vector, as the model was
        trained: "mean" for all-MiniLM-L6-v2 (the default), "cls" for the arctic models.`,
      value: 'mean'
    },
    {
      class: 'String',
      name: 'queryPrefix',
      documentation: `Put before a search question, never before a document, for a model trained
        with one, e.g. "Represent this sentence for searching relevant passages: " for the
        arctic models: without it, arctic-embed-xs found the right document in the top 3 for
        10 of 22 questions instead of 21. Empty, the default, means no prefix, as for
        all-MiniLM-L6-v2.`
    },
    {
      class: 'String',
      name: 'status',
      documentation: `What the model is doing before it can run, e.g. "Preparing… 35%" while it
        downloads, then "Getting ready…" while it loads. Empty once it is ready, so a view can
        show it while a first call waits on the download.`,
      transient: true
    },
    {
      name: 'pipeline_',
      transient: true,
      hidden: true,
      factory: function() {
        return this.TransformersPipeline.create({
          task:       'feature-extraction',
          model:      this.model,
          dtype:      { gpu: 'fp32', wasm: 'q8' },
          onProgress: percent => this.onProgress_(percent)
        });
      }
    }
  ],

  methods: [
    function getModel() {
      return this.model;
    },

    // once every byte is in, the model takes a few seconds to load before it runs
    function onProgress_(percent) {
      this.status = percent < 100 ? this.PREPARING + ' ' + percent + '%' : this.GETTING_READY;
    },

    // one text, a search question: it gets the model's question prefix
    async function embed(x, text) {
      var e = (await this.embedAll(x, [ this.queryPrefix + text ]))[0];
      e.text = text;
      return e;
    },

    async function embedAll(x, texts) {
      await this.pipeline_.load();
      this.status = '';
      var options = { pooling: this.pooling, normalize: true };
      var vectors = [];
      for ( var i = 0 ; i < texts.length ; i += this.BATCH_SIZE ) {
        vectors.push(...await this.pipeline_.run(texts.slice(i, i + this.BATCH_SIZE), options));
      }
      // A NaN vector would break the search order for every question, so a text that gets one
      // is run again on its own, and if that fails too the call throws: the record stays
      // waiting for the next sync instead of storing a bad vector.
      for ( var j = 0 ; j < vectors.length ; j++ ) {
        if ( ! vectors[j].some(isNaN) ) continue;
        vectors[j] = (await this.pipeline_.run([ texts[j] ], options))[0];
        if ( vectors[j].some(isNaN) ) throw new Error('The model returned no usable vector for one text');
      }
      return texts.map((text, i) => foam.ai.vector.VectorEmbedding.create({
        text:           text,
        embeddingModel: this.model,
        vector:         vectors[i]
      }));
    }
  ]
});
