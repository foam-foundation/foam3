/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.vector',
  name: 'ClientMarkdownChunkerService',
  implements: ['foam.ai.vector.ChunkerService'],

  properties: [
    {
      class: 'Int',
      name: 'maxChunkChars',
      value: 2000
    }
  ],

  methods: [
    async function chunk(x, source) {
      const chunks = [];
      const lines  = source.split('\n');
      const crumbs = [];
      let   buf    = '';

      const stripMarkdown = s => s
        .replace(/^#+ ?/gm,                '')
        .replace(/^> ?/gm,                 '')
        .replace(/\*\*|__/g,               '')
        .replace(/`/g,                     '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g,  '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

      const buildCrumb = depth =>
        crumbs.slice(0, depth).filter(Boolean).join(' > ');

      const addChunk = (raw, depth) => {
        const clean = stripMarkdown(raw).trim();
        if ( ! clean ) return;
        const crumb = buildCrumb(depth);
        chunks.push(crumb ? crumb + '\n\n' + clean : clean);
      };

      const flush = depth => {
        if ( buf.trim() ) addChunk(buf, depth);
      };

      let depth = 0;
      for ( const line of lines ) {
        const m = line.match(/^(#{1,6}) /);
        if ( m ) {
          flush(depth);
          buf = '';
          depth = m[1].length;
          crumbs[depth - 1] = line.slice(depth + 1).trim();
          crumbs.length = depth;
          continue;
        }

        buf += line + '\n';

        if ( buf.length > this.maxChunkChars ) {
          const split = buf.lastIndexOf('\n\n', this.maxChunkChars);
          if ( split > 0 ) {
            addChunk(buf.slice(0, split), depth);
            buf = buf.slice(split);
          } else {
            flush(depth);
            buf = '';
          }
        }
      }
      flush(depth);
      return chunks;
    }
  ]
});
