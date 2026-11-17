/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector.provider',
  name: 'TransformersEmbeddingService',
  implements: ['foam.ai.vector.EmbeddingService'],

  requires: ['foam.u2.ModuleLib'],

  messages: [
    { name: 'DOWNLOADING', message: 'Downloading the model to this browser' },
    { name: 'LOADING',     message: 'Loading the model in this browser…' }
  ],

  constants: {
    CDN: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
  },

  properties: [
    {
      class: 'String',
      name: 'model',
      value: 'Xenova/all-MiniLM-L6-v2'
    },
    {
      class: 'String',
      name: 'status',
      documentation: `What the model is doing before it can run, e.g. "Downloading the model to
        this browser: onnx/model_quantized.onnx 45%". Empty once it is ready, so a view can
        show it while a first call waits on the download.`,
      transient: true
    },
    {
      name: 'pipeline_',
      transient: true,
      hidden: true
    }
  ],

  methods: [
    // transformers.js reports each file of the model as it downloads ({ status: 'progress', file, progress })
    // and 'done' when a file is in; the model then takes a few seconds to load before it runs
    function onProgress_(p) {
      if ( p.status === 'progress' ) this.status = this.DOWNLOADING + ': ' + p.file + ' ' + Math.round(p.progress) + '%';
      if ( p.status === 'done' )     this.status = this.LOADING;
    },

    async function ensurePipeline_() {
      if ( ! this.pipeline_ ) {
        const mod = await this.ModuleLib.create({ src: this.CDN }).installLib();
        if ( ! mod ) throw new Error('Failed to load Transformers.js from ' + this.CDN);
        // only fetch from HuggingFace; skip the localhost /models/ probe
        mod.env.allowLocalModels = false;
        this.pipeline_ = await mod.pipeline('feature-extraction', this.model, { progress_callback: p => this.onProgress_(p) });
        this.status    = '';
      }
    },

    async function embed(x, text) {
      return (await this.embedAll(x, [text]))[0];
    },

    async function embedAll(x, texts) {
      await this.ensurePipeline_();
      return Promise.all(texts.map(async text => {
        const out = await this.pipeline_(text, { pooling: 'mean', normalize: true });
        return foam.ai.vector.VectorEmbedding.create({
          text:           text,
          embeddingModel: this.model,
          vector:         Array.from(out.data)
        });
      }));
    }
  ]
});
