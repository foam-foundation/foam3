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
      name: 'worker_',
      hidden: true,
      transient: true
    },
    {
      name: 'workerUrl_',
      documentation: 'The Blob URL the worker was made from, released when the worker ends.',
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
        this.loaded_ = this.post_({ load: { task: this.task, model: this.model, dtype: this.dtype } }, { onProgress: this.onProgress, files: {} })
          .catch(e => { this.loaded_ = null; throw e; });
      }
      return this.loaded_;
    },

    async function run(...args) {
      await this.load();
      return this.post_({ args: args, stream: !! this.onText }, { onText: this.onText });
    },

    // Ends the worker and frees the model it holds, e.g. when the page that uses it is
    // removed. A later call starts a new worker and loads the model again.
    function terminate(error) {
      var calls = this.calls_;
      this.calls_ = {};
      if ( this.worker_ ) this.worker_.terminate();
      if ( this.workerUrl_ ) URL.revokeObjectURL(this.workerUrl_);
      this.worker_    = null;
      this.workerUrl_ = null;
      this.loaded_    = null; // a new worker starts with no model, so the next call loads it again
      for ( var id in calls ) calls[id].reject(error || new Error('The model was stopped'));
    },

    // handlers belong to the call, so a progress or text message goes to the call it answers
    function post_(msg, handlers) {
      if ( ! this.worker_ ) {
        this.workerUrl_ = URL.createObjectURL(new Blob([ this.workerCode_() ], { type: 'text/javascript' }));
        this.worker_ = new Worker(this.workerUrl_, { type: 'module' });
        this.worker_.onmessage = e => this.onMessage_(e.data);
        // the worker could not start, e.g. the CDN is unreachable: every waiting call fails
        this.worker_.onerror = e => {
          var where = e.filename ? ' at ' + e.filename + ':' + e.lineno : '';
          this.terminate(new Error('Failed to start Transformers.js from ' + this.CDN + ': ' + ( e.message || 'worker error' ) + where));
        };
      }
      return new Promise((resolve, reject) => {
        var id = ++this.lastId_;
        this.calls_[id] = Object.assign({ resolve: resolve, reject: reject }, handlers);
        this.worker_.postMessage(Object.assign({ id: id }, msg));
      });
    },

    function onMessage_(data) {
      var call = this.calls_[data.id];
      // the answer of a call already failed by terminate
      if ( ! call ) return;
      if ( data.progress ) {
        // transformers.js reports each file apart, e.g. { status: 'progress', file: 'onnx/model.onnx',
        // loaded, total }; a file served with no size has total 0 and is left out of the sum.
        // The files are kept per load, so a second attempt does not add to the first one's bytes.
        var p = data.progress;
        if ( p.status === 'progress' && p.total && call.onProgress ) {
          call.files[p.file] = p;
          var loaded = 0, total = 0;
          for ( var f in call.files ) { loaded += call.files[f].loaded; total += call.files[f].total; }
          call.onProgress(Math.floor(100 * loaded / total));
        }
        return;
      }
      if ( 'text' in data ) {
        call.onText(data.text);
        return;
      }
      delete this.calls_[data.id];
      if ( data.error ) call.reject(new Error(data.error)); else call.resolve(data.result);
    },

    function workerCode_() {
      // The worker answers one message at a time: a model session runs one call at once.
      // A GPU that fails to load the model, e.g. a driver WebGPU does not support, falls back
      // to WebAssembly; a failure while the model runs is reported as an error.
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
        // a failed import is reported to the call that awaits it, not as an unhandled rejection
        lib.catch(() => {});
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
    without one, where it runs on 8-bit weights.
  `,

  requires: [ 'foam.ai.vector.provider.TransformersPipeline' ],

  constants: [
    // Larger batches on WebGPU can return NaN vectors for some texts of a long document
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
        arctic models. Empty, the default, means no prefix, as for all-MiniLM-L6-v2.`
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
    // ends the worker that holds the model, e.g. when the page is removed
    function terminate() {
      this.pipeline_.terminate();
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
      // a failed download must not leave "Preparing… 35%" on screen over the error
      try {
        await this.pipeline_.load();
      } finally {
        this.status = '';
      }
      var options = { pooling: this.pooling, normalize: true };
      var vectors = [];
      for ( var i = 0 ; i < texts.length ; i += this.BATCH_SIZE ) {
        vectors.push(...await this.pipeline_.run(texts.slice(i, i + this.BATCH_SIZE), options));
      }
      // A NaN vector would break the search order for every question, so a text that gets one
      // is run again on its own, and if that fails too the call throws instead of returning
      // a bad vector.
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
