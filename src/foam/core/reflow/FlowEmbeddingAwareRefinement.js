/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowEmbeddingAwareRefinement',
  refines: 'foam.core.reflow.Flow',
  implements: [ 'foam.ai.vector.EmbeddingAware' ],

  documentation: `
    Keeps the Knowledge Base searchable as its documents change: a Flow tagged
    with the keyword "knowledge" is embedded from its name, description and
    markdown when it is saved. Any other Flow, e.g. a dashboard, is not
    embedded, and its toIndexText is empty so that saving it costs no more
    than the decorator's own lookup of the stored record.
    A flow loaded from a journal at boot is not embedded, because journal
    replay runs below the EmbeddingAwareDAO decorator: its chunks come from
    the shipped seed until it is saved.
  `,

  javaImports: [
    'foam.core.reflow.ScriptParser',
    'foam.util.SafetyUtil',
    'java.util.Arrays',
    'java.util.List',
    'java.util.Map'
  ],

  methods: [
    {
      // A Knowledge Base document is one markdown block, so its text is that
      // markdown under the flow's name and description. Code, charts and
      // tables of other blocks are left out: they read as noise to a search.
      name: 'toIndexText',
      code: function(x) {
        if ( ! this.isEmbeddable(x) ) return '';
        var parts = [ this.name ];
        if ( this.description ) parts.push(this.description);
        var blocks;
        try { blocks = JSON.parse(this.script || '[]'); } catch ( e ) { blocks = []; }
        if ( Array.isArray(blocks) ) blocks.forEach(b => {
          var md = b && b.value && b.value.markdown;
          if ( typeof md === 'string' ) parts.push(md);
        });
        return parts.join('\n\n');
      },
      javaCode: `
        if ( ! isEmbeddable(x) ) return "";
        StringBuilder sb = new StringBuilder(getName());
        if ( ! SafetyUtil.isEmpty(getDescription()) ) sb.append("\\n\\n").append(getDescription());
        Object blocks = ScriptParser.parseData(getScript());
        if ( blocks instanceof Object[] ) blocks = Arrays.asList((Object[]) blocks);
        if ( ! ( blocks instanceof List ) ) return sb.toString();
        for ( Object b : (List) blocks ) {
          Object value = b instanceof Map ? ((Map) b).get("value") : null;
          Object md    = value instanceof Map ? ((Map) value).get("markdown") : null;
          if ( md instanceof String ) sb.append("\\n\\n").append((String) md);
        }
        return sb.toString();
      `
    },
    {
      // The Knowledge Base lists the flows tagged "knowledge"; only those are searched
      name: 'isEmbeddable',
      code: function(x) { return ( this.keywords || [] ).includes('knowledge'); },
      javaCode: 'return getKeywords() != null && Arrays.asList(getKeywords()).contains("knowledge");'
    }
  ]
});
