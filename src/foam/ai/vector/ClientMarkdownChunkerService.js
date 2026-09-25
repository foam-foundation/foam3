/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'ClientMarkdownChunkerService',
  implements: ['foam.ai.vector.ChunkerService'],

  requires: ['foam.ai.vector.MarkdownChunkParser'],

  properties: [
    {
      class: 'Int',
      name: 'maxChunkChars',
      value: 2000
    }
  ],

  methods: [
    async function chunk(x, source) {
      var sections = this.MarkdownChunkParser.create().parseString(source);
      var chunks   = [];

      for ( var i = 0; i < sections.length; i++ ) {
        var body = sections[i].body;
        if ( ! body ) continue;

        if ( body.length <= this.maxChunkChars ) {
          chunks.push(body);
        } else {
          // section exceeds limit — split on paragraph breaks
          var paras = body.split('\n\n');
          var buf   = '';
          for ( var j = 0; j < paras.length; j++ ) {
            var para = paras[j].trim();
            if ( ! para ) continue;
            if ( buf && buf.length + para.length + 2 > this.maxChunkChars ) {
              chunks.push(buf);
              buf = para;
            } else {
              buf = buf ? buf + '\n\n' + para : para;
            }
          }
          if ( buf ) chunks.push(buf);
        }
      }

      return chunks;
    }
  ]
});
