/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'SaveFlowToFileRuleAction',
  implements: [ 'foam.core.ruler.RuleAction' ],
  documentation: 'RuleAction for saving the contents of a flow to a source file',

  javaImports: [
    'java.nio.file.Path',
    'java.nio.file.Paths',
    'java.nio.file.Files',
    'java.util.Arrays',
    'java.util.Collections',
    'java.util.List',
    'java.util.Map',
    'foam.util.SafetyUtil',
    'foam.core.logger.Logger',
    'foam.core.reflow.Flow',
    'foam.core.app.AppConfig',
    'foam.core.app.Mode',
    'foam.core.reflow.ScriptParser'
  ],

  constants: [
    { 
      name: 'FLOW_TAG_PROPS',
      type: 'String[]',
      javaValue: 'new String[] { "category", "label", "description", "notes", "spid", "accessLevel", "keywords" }'
    }
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        Logger logger = (Logger) x.get("logger");
        
        // Get the flow that just changed
        Flow newFlow = (Flow) obj;

        // Get appConfig to figure out what mode we're in
        AppConfig appConfig = (AppConfig) x.get("appConfig");
        if ( appConfig == null || 
          ( appConfig.getMode() != Mode.DEVELOPMENT 
            && appConfig.getMode() != Mode.TEST ) )
        {
          // Only allow flow-to-file saves in dev or test mode
          return;
        }

        // Get the source file
        String sourceFile = newFlow.getSource();
        if ( SafetyUtil.isEmpty(sourceFile) ) return;

        // If the extension isn't 'md' or 'flow' we can't do anything with it
        if ( ! sourceFile.endsWith(".md") && ! sourceFile.endsWith(".flow") ) {
          logger.warning("SaveFlowToFileRuleAction aborted: source " + sourceFile + " extension is not supported");
          newFlow.setStatus("WARNING: Flow could not be saved to file " + sourceFile + " extension is not supported")''
          return;
        }

        // Skip if nothing that ends up in the file changed
        if ( oldObj != null ) {
          Flow    oldFlow = (Flow) oldObj;
          boolean changed =
            ! SafetyUtil.equals(oldFlow.getScript(), newFlow.getScript()) ||
            ! SafetyUtil.equals(oldFlow.getSource(), newFlow.getSource()) ||
            ! SafetyUtil.equals(oldFlow.getName(),   newFlow.getName());

          foam.lang.ClassInfo info = newFlow.getClassInfo();
          for ( int i = 0 ; ! changed && i < FLOW_TAG_PROPS.length ; i++ ) {
            foam.lang.PropertyInfo p = (foam.lang.PropertyInfo) info.getAxiomByName(FLOW_TAG_PROPS[i]);
            if ( p != null && p.compare(oldFlow, newFlow) != 0 ) changed = true;
          }

          if ( ! changed ) return;
        }

        // Parse the script into plain data (Maps, Lists/Object[], Strings, ...)
        Object parsed = ScriptParser.parseData(newFlow.getScript());
        if ( parsed == null ) {
          logger.warning("SaveFlowToFileRuleAction aborted: script did not parse", newFlow.getName());
          newFlow.setStatus("WARNING: Flow script did not parse. Flow was not saved to file");
          return;
        }

        // Holder for whatever we save to the file, later
        String fileContents = "";

        // If we're supposed to be saving to an MD file...
        if ( sourceFile.endsWith(".md") ) {
          // Retrieve the content of the MD block. If there is more than
          // one block or the single block isn't an MD block, this returns null
          String markdown = singleMarkdownText(parsed);
          if ( markdown == null ) {
            logger.warning("SaveFlowToFileRuleAction .md files cannot contain multiple or non-markdown blocks. Saving " + newFlow.getName() + " as a .flow file, instead");
            sourceFile = sourceFile.substring(0, sourceFile.lastIndexOf('.')) + ".flow";
            var extension = "flow";
            newFlow.setSource(sourceFile);
            newFlow.setStatus("WARNING: .md files cannot contain multiple or non-markdown blocks. Flow was saved to " + sourceFile + ", instead.");

          } else {
            // --------------- Only needed if we don't remove all the existing <flow> tags ------------------------
            String trimmed = markdown.stripLeading();
            if ( trimmed.regionMatches(true, 0, "<flow", 0, 5) ) {
              int end = trimmed.indexOf('>');
              if ( end != -1 ) {
                int i = end + 1;
                while ( i < trimmed.length() && ( trimmed.charAt(i) == '\\n' || trimmed.charAt(i) == '\\r' ) ) i++;
                markdown = trimmed.substring(i);
              }
            }
            // ----------------------------------------------------------------------------------------------------

            // If we've gotten this far, we're good to create a flow tag and build the fileContents
            StringBuilder flowTagBuilder = new StringBuilder("<flow name=")
              .append('"').append(escapeAttr(newFlow.getName())).append('"');
            foam.lang.ClassInfo info = newFlow.getClassInfo();

            // Loop through the properties we care about
            for ( String attr : FLOW_TAG_PROPS ) {
              foam.lang.PropertyInfo p = (foam.lang.PropertyInfo) info.getAxiomByName(attr);
              if ( p == null || ! p.isSet(newFlow) ) continue; // Only take explicitly set values

              // Get the property value and convert it to a string (if needed)
              Object v = p.get(newFlow);
              String text =
                v instanceof String[]       ? String.join(",", (String[]) v) : // keywords
                v instanceof Enum           ? ((Enum<?>) v).name()  : // accessLevel
                String.valueOf(v);

              // If the property isn't empty, add it to the flow tag
              if ( ! SafetyUtil.isEmpty(text) ) {
                flowTagBuilder.append(' ').append(attr).append('=').append('"').append(escapeAttr(text)).append('"');
              }
            }

            // Forcibly childLock flows that save to .md files
            flowTagBuilder.append(" childLock=\\"true\\"");
            flowTagBuilder.append("/>");

            // Add the flowTag to the top of the md and use that as the fileContents
            fileContents = flowTagBuilder.toString() + "\\n\\n" + markdown;
          }
        }
        
        // If this should be saved to a .flow file...
        if ( sourceFile.endsWith(".flow") ) {
          // .flow files contain the journal entry for a given flow, so if we're saving
          // to one we need to serialize the flow like we would when saving to a journal
          foam.lib.formatter.JSONFObjectFormatter formatter = new foam.lib.formatter.JSONFObjectFormatter(x);
          formatter.setPropertyPredicate(new foam.lib.StoragePropertyPredicate());
          formatter.setMultiLine(true);
          formatter.output(newFlow);
          fileContents = "p(" + formatter.builder().toString() + ")\\n";
        }

        // If we've gotten this far without issue, we're good to write back to a file
        Path baseDir = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize(); // KEVIN: Not sure if this is the right way to do this
        Path path = baseDir.resolve(sourceFile).normalize();
        if ( ! path.startsWith(baseDir) ) {
          logger.warning("SaveFlowToFileRuleAction source outside base dir", sourceFile);
          newFlow.setStatus("WARNING: source path " + sourceFile + " is outside base directory. Flow could not be saved to file.");
          return;
        }

        try {
          // Skip the write when the file already holds exactly this content
          if ( Files.exists(path) &&
              fileContents.equals(Files.readString(path, java.nio.charset.StandardCharsets.UTF_8)) )
          {
            return;
          }

          // Otherwise, save and let the user know if it succeeds
          Files.createDirectories(path.getParent());
          Files.writeString(path, fileContents, java.nio.charset.StandardCharsets.UTF_8);
          newFlow.setStatus("PASSED: flow successfully saved to source file " + sourceFile);

        } catch ( java.io.IOException e ) {
          logger.error("SaveFlowToFileRuleAction", "failed to write", path, e);
          newFlow.setStatus("FAILED: save to source file " + sourceFile + " failed.");
        }
      `
    },
    {
      name: 'singleMarkdownText',
      documentation: `If the parsed script holds exactly one block and it is markdown,
        returns that block's text ("" if empty). Otherwise returns null.`,
      type: 'String',
      args: 'Object parsed',
      javaCode: `
        List items = toList(parsed);
        if ( items.size() != 1 || ! ( items.get(0) instanceof Map ) ) return null;

        Map block = (Map) items.get(0);

        // A single top-level block with nested children still means multiple blocks
        if ( ! toList(block.get("flowChildren")).isEmpty() ) return null;

        Object value = block.get("value");
        if ( ! ( value instanceof Map ) ) return null;

        Map v = (Map) value;
        if ( ! "foam.core.reflow.Markdown".equals(v.get("class")) ) return null;

        // An empty markdown block has no "markdown" key (defaults aren't serialized)
        Object md = v.get("markdown");
        return md instanceof String ? (String) md : "";
      `
    },
    {
      name: 'toList',
      documentation: 'Normalizes parsed JSON arrays (Object[] or List) to a List; anything else is empty.',
      javaType: 'java.util.List',
      args: 'Object o',
      javaCode: `
        if ( o instanceof Object[] ) return Arrays.asList((Object[]) o);
        if ( o instanceof List )     return (List) o;
        return Collections.emptyList();
      `
    },
    {
      name: 'escapeAttr',
      documentation: `
        Replace problematic special characters with HTML-style equivalents so
        they don't break the reg-ex here or in JournalMaker during parsing
      `,
      javaType: 'String',
      args: 'String s',
      javaCode: `
        return s.replace("&", "&amp;")
        .replace("\\"", "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;");
      `
    }
  ]
});