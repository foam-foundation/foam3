/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'LoadFlowFromFileDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `
    Reverse of SaveFlowToFileRuleAction. In DEVELOPMENT or TEST mode, a flow
    with its 'source' set is returned as read from that .md or .flow file
    rather than as stored in the journal, so edits made to the file with a
    normal editor show up without a rebuild.
  `,

  javaImports: [
    'foam.core.app.AppConfig',
    'foam.core.app.Mode',
    'foam.core.logger.Logger',
    'foam.core.reflow.Flow',
    'foam.core.reflow.ScriptParser',
    'foam.lang.ClassInfo',
    'foam.lang.PropertyInfo',
    'foam.lib.json.JSONParser',
    'foam.util.SafetyUtil',
    'java.nio.charset.StandardCharsets',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.Paths',
    'java.util.ArrayList',
    'java.util.LinkedHashMap',
    'java.util.List',
    'java.util.Map',
    'java.util.regex.Matcher',
    'java.util.regex.Pattern'
  ],

  javaCode: `
    // Same patterns JournalMaker uses to read the <flow> tag of a .md file
    // (tools/JournalMaker.js), so a file loads here as it would at build time.
    protected static final Pattern FLOW_TAG  = Pattern.compile("<flow\\\\b([^>]*?)/?>[ \\\\t]*\\\\r?\\\\n?", Pattern.CASE_INSENSITIVE);
    protected static final Pattern FLOW_ATTR = Pattern.compile("([a-zA-Z][-a-zA-Z0-9_]*)\\\\s*=\\\\s*(?:\\"([^\\"]*)\\"|'([^']*)')");
  `,

  methods: [
    {
      name: 'find_',
      javaCode: `
        Flow flow = (Flow) getDelegate().find_(x, id);
        if ( flow == null || SafetyUtil.isEmpty(flow.getSource()) ) return flow;

        // Only read from files in dev or test mode, as SaveFlowToFileRuleAction
        // only writes to them in those modes
        AppConfig appConfig = (AppConfig) x.get("appConfig");
        if ( appConfig == null ||
          ( appConfig.getMode() != Mode.DEVELOPMENT
            && appConfig.getMode() != Mode.TEST ) )
        {
          return flow;
        }

        String sourceFile = flow.getSource();
        Path   baseDir    = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        Path   path       = baseDir.resolve(sourceFile).normalize();
        if ( ! path.startsWith(baseDir) || ! Files.isRegularFile(path) ) return flow;

        Logger logger = (Logger) x.get("logger");
        try {
          String text   = Files.readString(path, StandardCharsets.UTF_8);
          Flow   loaded =
            sourceFile.endsWith(".md")   ? fromMarkdown(flow, text) :
            sourceFile.endsWith(".flow") ? fromFlowFile(x, flow, text) :
            null;

          if ( loaded == null ) {
            if ( logger != null ) logger.warning("LoadFlowFromFileDAO", "could not load flow from", sourceFile, "using journal copy");
            return flow;
          }

          // loaded.freeze();
          return loaded;
        } catch ( java.io.IOException e ) {
          if ( logger != null ) logger.error("LoadFlowFromFileDAO", "failed to read", path, e);
          return flow;
        }
      `
    },
    {
      name: 'fromMarkdown',
      documentation: `
        Builds the flow from a .md file as JournalMaker does: the <flow> tag
        supplies the FLOW_TAG_PROPS and the rest of the file becomes a single
        markdown block. Returns null if the file has no <flow> tag.
      `,
      type: 'foam.core.reflow.Flow',
      args: 'Flow flow, String text',
      javaCode: `
        Matcher tag = FLOW_TAG.matcher(text);
        if ( ! tag.find() ) return null;

        Map<String, String> attrs = new LinkedHashMap<>();
        Matcher attr = FLOW_ATTR.matcher(tag.group(1));
        while ( attr.find() ) {
          attrs.put(attr.group(1), unescapeAttr(attr.group(2) != null ? attr.group(2) : attr.group(3)));
        }

        // Drop the tag and the blank lines SaveFlowToFileRuleAction writes after it
        String markdown = ( text.substring(0, tag.start()) + text.substring(tag.end()) )
          .replaceFirst("^(?:[ \\\\t]*\\\\r?\\\\n)+", "");

        Flow      clone = (Flow) flow.fclone();
        ClassInfo info  = clone.getClassInfo();

        // The file is authoritative: an attribute removed from the tag clears the property
        for ( String name : SaveFlowToFileRuleAction.FLOW_TAG_PROPS ) {
          PropertyInfo p = (PropertyInfo) info.getAxiomByName(name);
          if ( p == null ) continue;

          String value = attrs.get(name);
          if ( SafetyUtil.isEmpty(value) ) {
            p.clear(clone);
          } else if ( "keywords".equals(name) ) {
            List<String> kws = new ArrayList<>();
            for ( String k : value.split(",") ) if ( ! k.trim().isEmpty() ) kws.add(k.trim());
            p.set(clone, kws.toArray(new String[0]));
          } else {
            // String props pass through; accessLevel's cast() resolves the enum by name
            p.set(clone, value);
          }
        }

        if ( attrs.containsKey("childLock") ) clone.setChildLock("true".equals(attrs.get("childLock")));

        Map<String, Object> value = new LinkedHashMap<>();
        value.put("class",    "foam.core.reflow.Markdown");
        value.put("markdown", markdown);

        Map<String, Object> block = new LinkedHashMap<>();
        block.put("flowName", "markdown1");
        block.put("cmd",      "markdown");
        block.put("value",    value);

        clone.setScript(ScriptParser.stringify(List.of(block)));
        return clone;
      `
    },
    {
      name: 'fromFlowFile',
      documentation: `
        Builds the flow from a .flow file, which holds a single p({...}) journal
        entry. Returns null if the entry does not parse.
      `,
      type: 'foam.core.reflow.Flow',
      args: 'X x, Flow flow, String text',
      javaCode: `
        String entry = text.trim();
        if ( ! entry.startsWith("p(") || ! entry.endsWith(")") ) return null;

        Flow fileFlow = (Flow) x.create(JSONParser.class)
          .parseString(entry.substring(2, entry.length() - 1), Flow.class);
        if ( fileFlow == null ) return null;

        Flow clone = (Flow) flow.fclone();
        clone.copyFrom(fileFlow);

        // The flow was found by name, so keep that id and the file it came from
        clone.setName(flow.getName());
        clone.setSource(flow.getSource());
        return clone;
      `
    },
    {
      name: 'unescapeAttr',
      documentation: 'Reverses SaveFlowToFileRuleAction.escapeAttr.',
      type: 'String',
      args: 'String s',
      javaCode: `
        return s.replace("&quot;", "\\"").replace("&apos;", "'")
          .replace("&lt;", "<").replace("&gt;", ">")
          .replace("&amp;", "&"); // last, so "&amp;lt;" stays "&lt;"
      `
    }
  ]
});
