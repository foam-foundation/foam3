/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'SaveToMarkdownRuleAction',
  implements: [ 'foam.core.ruler.RuleAction' ],
  documentation: 'RuleAction for saving the contents of markdown flows back to their source files',

  javaImports: [
    'java.util.ArrayList',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.lang.ContextAgent',
    'foam.util.SafetyUtil',
    'foam.core.logger.Logger',
    'foam.core.reflow.Flow',
    'foam.core.auth.AuthorizationException'
  ],

  // Watch the flowDAO
  // Check for puts that have a markdown block
  // If it has a markdown block, look for the flow tag
  // -> No flow tag = ignore
  // -> Has flow tag = continue
  // Check for a source file
  // -> No source file = make a new file (prompt user for location?)
  // -> Has source file = copy markdown contents back to the source file
  // Changes to the FLOW but not the FLOW tag need to be handled.
  // 1) Ignore. Only care about flow tag content
  // 2) Override. Replace flow tag content during save
  // 3) Handle elswhere. Build code to propagate changes to any flow tags when changes are made
  // 4) Ask/warn the user. Indicate the difference and ask them to correct or override.
  // Treat the actual flow contents as source of truth always, and in the case of override, replace MD contents.


  methods: [
    {
      name: 'applyAction',
      javaCode: `
        Logger logger = (Logger) x.get("logger");
        
        // Get the flow that just changed
        Flow newFlow = (Flow) obj;

        // Get the source file
        String sourceFile = newFlow.getSource();

        // Counter for how many mdBlocks are in this flow
        // (Used to detect multi-md-block flows using the flow tag)
        int mdBlockCount = 0;

        // Flag for if we've found a flowTag
        // (Used to detect multiple flow tags in a single flow)
        boolean foundFlowTag = false;

        String flowTagContent = "";
        int flowTagCmdIndex = -1;

        // Iterate through all of the commands in the flow script
        String[] cmds = newFlow.getScript().split("\\"cmd\\":");
        for ( String cmd : cmds ) {
          // Skip non-markdown blocks
          if ( ! cmd.startsWith("\\"markdown\\"") ) continue;
          mdBlockCount++; // Keep track of how many MD blocks we find

          // Look for the flow tag
          int flowTagStart = cmd.indexOf("<flow");
          if ( flowTagStart == -1 ) {
            continue; // Skip MD blocks without one
          }

          // If we already found a flow tag, warn the user that they can't have more than one
          if ( foundFlowTag ) {
            var e = new AuthorizationException("Multiple markdown <flow> tags detected. Please remove additional tags before saving.");
            e.setIsClientException(true);
            throw e;
          }

          // Get the contents of the flow tag and save 'em
          String partialCmdString = cmd.substring(flowTagStart);
          int flowTagEnd = partialCmdString.indexOf("/>");
          flowTagContent = partialCmdString.substring(0, flowTagEnd + 2);
          foundFlowTag = true;
          //flowTagCmdIndex = cmds.indexOf(cmd);
        }

        if ( mdBlockCount == 0 ) return; // No MD blocks means this save doesn't concern us

        // If there is more than one MD block present and the flow tag was found
        if ( mdBlockCount > 1 && foundFlowTag ) {
          // Warn the user that only the contents of the block
          // with the flow tag will be saved to the source file

          // (Open dialogue and wait for choice)
          // -> Proceed = save only flow tag block contents to file
          // -> Cancel = abort save
        }

        if ( ! SafetyUtil.isEmpty(sourceFile) && ! foundFlowTag ) { // SourceFile but no flow tag
          // Check if there are MD blocks present
          if ( mdBlockCount > 0 ) {
            // If there are, warn the user that they may have forgotten the flow tag
            
            // (Open dialogue and wait for choice)
            // -> Proceed = return from rule, nothing needs to be saved to a file
            // -> Cancel = abort save
          }

        } else if ( SafetyUtil.isEmpty(sourceFile) && foundFlowTag ) { // Flow tag but no sourceFile
          // Warn the user that there is no sourceFile to save
          // the MD to and ask if they want us to create one

          // (Open dialogue and wait for choice)
          // -> Proceed = create file with flowName as fileName and .md extension under some default directory OR ask user to provide a home
          // -> Cancel = return from rule, nothing needs to be saved to a file

        } else if ( ! SafetyUtil.isEmpty(sourceFile) && foundFlowTag ) { // SourceFile and flow tag are present
          // Compare properties of flow to flow tag
          // -> Different = check if user wants us to override flow tag or adjust themselves
          // -> Same = Proceed

        } else { // No flow tag or sourceFile
          return; // no-op, we can't do anything with the MDs that are there
        }

        // Copy contents of flow tag MD block to sourceFile
        return;
      `
    }
  ]
});