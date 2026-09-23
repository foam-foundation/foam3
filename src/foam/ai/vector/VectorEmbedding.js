foam.CLASS({
  package: 'foam.ai.vector',
  name: 'VectorEmbedding',

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'text'        // original chunk
    },
    {
      class: 'String',
      name: 'sourceId'   // classId, doc path, etc.
    },
    {
      class: 'String',
      name: 'kind'       // 'class' | 'property' | 'method'
    },
    {
      class: 'foam.lang.FloatArray',
      name: 'vector',
      networkTransient: true  // large; server-only, never sent to client
    }
  ],

  methods: [
    function toSummary() {
      return `${this.kind}:${this.sourceId}`;
    }
  ]
});
