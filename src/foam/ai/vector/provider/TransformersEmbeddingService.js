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
      name: 'pipeline_',
      transient: true
    }
  ],

  methods: [
    async function ensurePipeline_() {
      if ( ! this.pipeline_ ) {
        const mod = await this.ModuleLib.create({ src: this.CDN }).installLib();
        if ( ! mod ) throw new Error('Failed to load Transformers.js from ' + this.CDN);
        // only fetch from HuggingFace; skip the localhost /models/ probe
        mod.env.allowLocalModels = false;
        this.pipeline_ = await mod.pipeline('feature-extraction', this.model);
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
          vector:         out.data
        });
      }));
    }
  ]
});
