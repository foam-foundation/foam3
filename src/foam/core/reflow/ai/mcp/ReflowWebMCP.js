/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.ai.mcp',
  name: 'ReflowWebMCP',

  documentation: `
    Registers the Console as an in-page MCP server, so an external coding agent
    drives the same command line a person does.

    foam.core.ai.mcp.MCPWebAgent is the server half. It already serves flowDAO
    and commandDAO to an external client through the DAO tools, so reading and
    writing flows needs nothing new here. What a server cannot serve is
    execution: a command runs through the Console's eval_ and renders into a
    Block's DOM, and neither exists outside the page. Those are the two things
    this registers.

    Two tools, because the command line is itself the uniform interface:
    'flows', 'daos', 'describe X', 'help' and 'FROM ... TO JSON' are commands,
    not extra tools. reflow_state exists only because an agent cannot see the
    page.

    Registered when a Console loads, but only for a user who has the 'mcp'
    command in scope: page tools live and die with the tab, so requiring a
    command in every new tab is a ritual, while the permission on that command
    is the real gate. commandDAO's authorized select decides both.

    Executing without proposing additionally needs the '!' agent command.

    https://github.com/webmachinelearning/webmcp
  `,

  requires: [ 'foam.core.reflow.Flow' ],

  imports: [
    'eval_',
    'findFlowChildByName',
    'flow',
    'flowChildren',
    'flowDAO',
    'localScope'
  ],

  constants: {
    // Tool name -> Flow whose markdown is the tool description, the convention
    // MCPWebAgent.TOOL_DOC_FLOWS uses, so the docs stay editable in the app.
    TOOL_DOC_FLOWS: {
      reflow_run:   'MCP:reflow_run',
      reflow_state: 'MCP:reflow_state',
      reflow_block: 'MCP:reflow_block'
    },
    // Rendered output is for an agent to read, not to page through.
    MAX_TEXT: 8192
  },

  properties: [
    {
      name: 'modelContext',
      hidden: true,
      transient: true,
      documentation: `The WebMCP entry point, or null where the browser has no
        such API. Injectable so the tools can be tested without an origin trial.`,
      factory: function() {
        return globalThis.document?.modelContext ||
               globalThis.navigator?.modelContext ||
               null;
      }
    },
    {
      name: 'controller_',
      hidden: true,
      transient: true,
      factory: function() { return new AbortController(); }
    }
  ],

  static: [
    {
      name: 'help',
      documentation: `What the 'mcp' command prints: the intro flow, the setup
        flow this browser needs, and one line of live status. All the wording
        lives in flows, so it stays editable in the app.`,
      code: async function(x) {
        var self  = foam.core.reflow.ai.mcp.ReflowWebMCP;
        var doc   = await x.flowDAO.find('MCP:howto');
        // Only the steps this browser actually needs. Each is its own flow, so
        // the wording stays editable in the app and the code only chooses.
        var setup = await x.flowDAO.find('MCP:setup-' + self.setupKind());

        return [
          doc && doc.markdown(),
          setup && setup.markdown(),
          await self.status()
        ].filter(p => p).join('\n\n');
      }
    },
    {
      name: 'setupKind',
      documentation: `Which setup flow this browser needs: none once the API is
        present, otherwise the flag for a browser that has one.`,
      code: function() {
        if ( globalThis.document?.modelContext ||
             globalThis.navigator?.modelContext ) return 'ready';

        var ua = globalThis.navigator?.userAgent || '';

        if ( ua.includes('Edg/') )                       return 'edge';
        if ( ua.includes('Chrome/') && ! ua.includes('OPR/') ) return 'chrome';

        return 'unsupported';
      }
    },
    {
      name: 'status',
      documentation: `One line on what this page exposes right now. A doc flow
        can describe the steps; only the live page knows whether they worked.`,
      code: async function() {
        var mc = globalThis.document?.modelContext || globalThis.navigator?.modelContext;

        if ( ! mc ) return '> Page tools: not registered.';

        var names = [];
        try {
          names = (await mc.getTools()).map(t => t.name);
        } catch (e) {
          // getTools is newer than registerTool; absence is not an error.
        }

        return names.length ?
          '> Page tools registered: `' + names.join('`, `') + '`' :
          '> Page tools: registration refused. Check the origin trial token and ' +
            'any `Permissions-Policy: tools=()` header.';
      }
    }
  ],

  methods: [
    async function install() {
      /** Register the tools, if this browser has WebMCP. Returns whether they
        registered, so the command can say so. */
      if ( ! this.modelContext )      return false;
      if ( ! this.localScope['mcp'] ) return false;

      this.onDetach(() => this.controller_.abort());

      var opts = { signal: this.controller_.signal };

      var tools = this.tools_();
      var registered = 0;

      for ( var i = 0 ; i < tools.length ; i++ ) {
        try {
          await this.modelContext.registerTool({
            name:        tools[i].name,
            description: await this.description_(tools[i]),
            inputSchema: tools[i].inputSchema,
            execute:     tools[i].execute
          }, opts);
          registered++;
        } catch (e) {
          // One tool the browser will not take must not cost the others, and
          // must not fail silently: registerTool rejects with NotAllowedError
          // where the origin disables tools, and on a schema it rejects.
          console.error('ReflowWebMCP: ' + tools[i].name + ' not registered', e);
        }
      }

      return registered > 0;
    },

    function tools_() {
      return [ {
        name: 'reflow_run',
        description: `Run one REFLOW command line against the open Console.
          Proposes it for the user to accept unless execute is set.`,
        inputSchema: {
          type: 'object',
          properties: {
            cmd: {
              type: 'string',
              description: 'One REFLOW command line, e.g. FROM userDAO TO JSON'
            },
            execute: {
              type: 'boolean',
              description: `Run the command now instead of proposing it for the
                user to accept. Requires the '!' agent command.`
            }
          },
          required: [ 'cmd' ]
        },
        execute: args => this.run_(args)
      }, {
        name: 'reflow_block',
        description: `Read a block's configuration, or change it. Charts are
          blocks whose select agent groups rows, so they are built here.`,
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: "A block's flowName, as reflow_state lists them"
            },
            config: {
              type: 'object',
              description: `Properties to set on the block's value, as FOAM JSON.
                Omit to read the block without changing it.`
            }
          },
          required: [ 'name' ]
        },
        execute: args => this.block_(args)
      }, {
        name: 'reflow_state',
        description: 'The flow open in the Console, and the blocks in it.',
        inputSchema: { type: 'object', properties: {} },
        execute: () => this.state_()
      } ];
    },

    async function description_(tool) {
      /** The tool's doc flow, and for reflow_run the agent's system prompt as
        well: an external agent should know the command language as well as the
        one inside the Console does. The flow is documentation, not the
        contract -- a browser rejects a tool with no description, so the
        descriptor's own line stands when no flow is loaded. */
      var parts = [];
      var doc   = await this.flowDAO.find(this.TOOL_DOC_FLOWS[tool.name]);

      if ( doc ) parts.push(doc.markdown());

      if ( tool.name === 'reflow_run' )
        parts.push(await this.Flow.systemPrompt(this.__context__));

      parts = parts.filter(p => p);

      return parts.length ? parts.join('\n\n') : tool.description;
    },

    async function run_(args) {
      var cmd     = args?.cmd;
      var execute = !! args?.execute;
      var denied  = execute && ! this.localScope['!'];

      if ( ! cmd ) return this.result_({ error: 'cmd is required' });

      // Proposing is the default, and the fallback: an agent that asks to
      // execute without the '!' command still gets its line in front of the
      // user rather than an error it cannot act on.
      var block = await this.eval_(( execute && ! denied ) ? cmd : 'propose ' + cmd);
      var out   = this.summary_(block);

      if ( denied )
        out.note = "Proposed rather than executed: the '!' command is not granted to this user.";

      return this.result_(out);
    },

    function block_(args) {
      /** Read a block's configuration, or patch it. A chart is a block whose
        value carries an agent and its grouping; the command line cannot say
        that, so this is how an agent builds one. */
      var name  = args?.name;
      if ( ! name ) return this.result_({ error: 'name is required' });

      var block = this.findFlowChildByName(name);
      if ( ! block ) return this.result_({ error: 'no block named ' + name });

      if ( args.config && block.value ) {
        try {
          Object.keys(args.config).forEach(k => {
            var v = args.config[k];
            // FOAM JSON: anything carrying a class -- an agent, a sink, a
            // __Property__ -- is hydrated; everything else is set as given.
            block.value[k] = ( v && v.class ) ? foam.json.parse(v, null, block) : v;
          });
          if ( block.value.run ) block.value.run();
        } catch (e) {
          return this.result_({ error: String(e && e.message || e) });
        }
      }

      var out = this.summary_(block);
      if ( block.value ) {
        try { out.config = foam.json.stringify(block.value); } catch (e) {}
      }
      return this.result_(out);
    },

    function state_() {
      /** What the agent cannot see: which flow is open and what is in it. */
      return this.result_({
        flow:   this.flow?.name,
        blocks: this.flowChildren.map(b => ({
          flowName: b.flowName,
          cmd:      b.cmd,
          error:    b.error
        }))
      });
    },

    function summary_(block) {
      var out = { flowName: block.flowName, cmd: block.cmd };

      if ( block.error ) out.error = block.error;

      if ( block.value ) {
        try {
          out.value = foam.json.stringify(block.value);
        } catch (e) {
          // A block value that will not serialize still has rendered text.
        }
      }

      var text = this.text_(block);
      if ( text ) out.text = text;

      return out;
    },

    function text_(block) {
      /** The block's rendered text. A table or a chart has no other textual
        form, so this is what AskCommand scrapes -- read here from the content
        element directly, and only once the command has resolved. */
      try {
        var text = block.content?.element_?.innerText || '';
        return text.length > this.MAX_TEXT ?
          text.substring(0, this.MAX_TEXT) + '\n...[truncated]' :
          text;
      } catch (e) {
        return '';
      }
    },

    function result_(o) {
      // The envelope WebMCP returns and MCPWebAgent.toolResult builds: one text
      // part carrying JSON.
      return { content: [ { type: 'text', text: JSON.stringify(o) } ] };
    }
  ]
});
