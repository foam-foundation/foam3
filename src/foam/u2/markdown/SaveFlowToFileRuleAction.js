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
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.Collections',
    'java.util.List',
    'java.util.Map',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.lang.ContextAgent',
    'foam.util.SafetyUtil',
    'foam.core.logger.Logger',
    'foam.core.reflow.Flow',
    'foam.core.auth.AuthorizationException',
    'foam.core.reflow.ScriptParser'
  ],

  // TODO: Check this compiles
  constants: { FLOW_TAG_PROPS: [ "category", "label", "description", "notes", "spid", "accessLevel", "keywords", "childLock" ] },

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        Logger logger = (Logger) x.get("logger");
        
        // Get the flow that just changed
        Flow newFlow = (Flow) obj;

        // Get the source file
        String sourceFile = newFlow.getSource();
        if ( SafetyUtil.isEmpty(sourceFile) ) return;

        // Figure out the source file's extension
        String fileName = sourceFile.substring(sourceFile.lastIndexOf("/") + 1);
        int dotIndex = fileName.lastIndexOf(".");
        String extension = dotIndex > 0 ? fileName.substring(dotIndex + 1).toLowerCase() : "";

        // If the extension isn't 'md' or 'flow' we can't do anything with it
        if ( ! SafetyUtil.equals(extension, "md") && ! SafetyUtil.equals(extension, "flow") ) {
          logger.log("SaveFlowToFileRuleAction aborted: source had an invalid extension (." + extension + ")");
          return;
        }

        // Parse the script into plain data (Maps, Lists/Object[], Strings, ...)
        Object parsed = ScriptParser.parseData(newFlow.getScript());
        if ( parsed == null ) {
          logger.warning("SaveFlowToFileRuleAction", "aborted: script did not parse", newFlow.getName());
          return;
        }

        // Holder for whatever we save to the file, later
        String fileContents = "";

        // If we're supposed to be saving to an MD file...
        if ( SafetyUtil.equals(extension, "md") ) {
          // Retrieve the content of the MD block. If there is more than
          // one block or the single block isn't an MD block, this returns null
          String markdown = singleMarkdownText(parsed);
          if ( markdown == null ) {
            logger.warning("SaveFlowToFileRuleAction .md files cannot contain multiple or non-markdown blocks. Saving " + newFlow.getName() + " as a .flow file, instead");

          } else {
            // If we've gotten this far, we're good to create a flow tag and build the fileContents
            //   <flow name="someName" category="optional" label="optional" description="optional"
            //         keywords="keyword1,keyword2,..." notes="optional" spid="optional"
            //         accessLevel="optional", childLock="true"/>
            // Loop through properties and handle each based on type
            StringBuilder flowTagBuilder = new StringBuilder("<flow name=").append('"' + newFlow.getName() + '"');
            foam.lang.ClassInfo info = newFlow.getClassInfo();

            for ( String attr : FLOW_TAG_PROPS ) {
              foam.lang.PropertyInfo p = (foam.lang.PropertyInfo) info.getAxiomByName(attr);
              if ( p == null || ! p.isSet(newFlow) ) continue;   // only explicitly set values

              Object v = p.get(newFlow);
              String text =
                v instanceof String[]       ? String.join(",", (String[]) v) :   // keywords
                v instanceof foam.lang.FEnum ? ((foam.lang.FEnum) v).getName()  :   // accessLevel
                String.valueOf(v);

              if ( ! SafetyUtil.isEmpty(text) ) flowTagBuilder.append(' ').append(attr).append('=').append('"' + text + '"');
            }

            flowTagBuilder.append("/>");

            // TODO: Add tag to markdown and set as fileContents
          }
        } else {

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
    }
  ]
});