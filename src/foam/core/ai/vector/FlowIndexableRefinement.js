/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector',
  name: 'FlowIndexableRefinement',
  refines: 'foam.core.reflow.Flow',
  implements: [ 'foam.ai.vector.Indexable' ],

  documentation: 'Lets Ask AI index a Flow: its name, description and markdown, opened as the Knowledge Base opens it.',

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
      javaCode: `
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
      // An answer's source link opens the document as the Knowledge Base does
      name: 'openIndexed',
      code: function(x) { this.REFLOW.code.call(this, x); }
    }
  ]
});
