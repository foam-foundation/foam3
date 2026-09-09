/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai.mcp',
  name: 'MCPCommand',
  extends: 'foam.core.reflow.cmd.Command',

  documentation: `
    REFLOW command that prints how to connect an external AI tool to this
    Console, with this session's own values filled in.

    Output goes to 'out', never through addValue: a Block serializes its value
    into the saved flow (Block.js:205-209), and this output is a live report of
    what the browser exposes right now. Saving the flow keeps the command, which
    reprints when it next runs.

    Registration itself happens when the Console loads, for any user whose
    commands include this one -- see ReflowWebMCP.
  `,

  requires: [
    'foam.core.reflow.Markdown',
    'foam.core.reflow.ai.mcp.ReflowWebMCP'
  ],

  properties: [
    {
      class: 'String',
      name: 'description',
      value: 'Show how to connect an external AI tool to this Console'
    }
  ],

  methods: [
    async function execute() {
      this.out.tag(this.Markdown, {
        markdown: await this.ReflowWebMCP.help(this.__context__)
      });
    }
  ]
});
