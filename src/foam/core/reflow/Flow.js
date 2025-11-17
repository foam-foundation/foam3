/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Flow',

  implements: [
    'foam.core.auth.Authorizable',
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware',
    'foam.core.auth.ServiceProviderAware'
  ],

  javaImports: [
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.AuthService',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.lang.X',
    'java.util.Arrays'
  ],


  imports: [ 'flowDAO', 'aiAsk?'],

  ids: [ 'name' ],
/*
  axioms: [
    {
      class: 'foam.comics.v2.CannedQuery',
      label: 'Public',
      predicateFactory: function(e, cls) { return e.EQ(cls.IS_PUBLIC, true); }
    },
    {
      class: 'foam.comics.v2.CannedQuery',
      label: 'Private',
      predicateFactory: function(e, cls) { return e.EQ(cls.IS_PUBLIC, false); }
    }
  ],
    */

  tableColumns: [ 'name', 'source', 'description', 'status', 'version', /* 'isPublic', 'readOnly', */ 'reflow' ],

  searchColumns: [ 'name', 'status', 'source', 'keywords' ],

  constants: { ROLE_PERMISSION_PREFIX: '@' },

  topics: [ 'loadComplete' ],

  sections: [
    {
      name: 'general',
      title: 'General',
    },
    {
      name: 'scriptSection',
      title: 'Script',
      collapsable: true,
      permissionRequired: true, // requires flow.section.scriptSection to access
      properties: [ 'preLoadScript', 'script', 'postLoadScript', 'aiPrompt', 'aiModel', 'aiChatPanel' ],
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'name',
      section: 'general',
    },
    {
      class: 'String',
      name: 'description',
      section: 'general',
      width: 80
    },
    {
      class: 'String',
      name: 'status',
      section: 'general',
      tableCellFormatter: function(value, obj) {
        if ( value.startsWith('PASSED') ) {
          this.style({color: 'green'});
        } else if ( value.startsWith('FAILED') ) {
          this.style({color: 'red'});
        }
        this.add(value);
      },
      width: 20
    },
    {
      class: 'String',
      name: 'source',
      reactive: false,
      section: 'general',
      width: 30
    },
    {
      class: 'StringArray',
      section: 'general',
      name: 'keywords'
    },
    {
      class: 'String',
      section: 'general',
      name: 'notes',
      section: 'general',
      width: 80,
      view: { class: 'foam.u2.tag.TextArea', rows: 3, cols: 78 }
    },
    {
      class: 'Enum',
      of: 'foam.core.reflow.FlowAccess',
      name: 'accessLevel',
      section: 'general',
      label: 'Access',
      value: foam.core.reflow.FlowAccess.PUBLIC_RW
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.reflow.UserFlowAccess',
      name: 'specifiedUserAccess',
      autoValidate: true,
      section: 'general',
      visibility: function(accessLevel) {
        return accessLevel != foam.core.reflow.FlowAccess.SHARED ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RW;
      }
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.reflow.RoleFlowAccess',
      name: 'specifiedRoleAccess',
      autoValidate: true,
      section: 'general',
      visibility: function(accessLevel) {
        return accessLevel != foam.core.reflow.FlowAccess.SHARED ? foam.u2.DisplayMode.HIDDEN : foam.u2.DisplayMode.RW;
      }
    },
    {
      name: 'lastModifiedByAgent',
      hidden: true
    },
    {
      name: 'createdByAgent',
      hidden: true
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.ServiceProvider',
      name: 'spid',
      reactive: false,
      section: 'general',
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'Int',
      name: 'version',
      visibility: 'HIDDEN',
      reactive: false,
      section: 'general'
    },
    {
      class: 'Int',
      name: 'revision',
      hidden: true,
      reactive: false,
      section: 'general',
      transient: true,
      xxxview: {
        class: 'foam.u2.view.DualView',
        viewa: { class: 'foam.u2.IntView' },
        viewb: { class: 'foam.u2.RangeView', onKey: true }
      }
    },
    {
      class: 'String',
      name: 'preLoadScript',
      section: 'scriptSection',
      documentation: 'Script to be run before the main script, typically used to set up classes or environment variables needed by the main script.',
      reactive: false,
      preSet: function(o, n) { return n.trim(); },
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 60 }
    },
    {
      class: 'String',
      name: 'postLoadScript',
      section: 'scriptSection',
      reactive: false,
      preSet: function(o, n) { return n.trim(); },
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 60 }
    },
    {
      class: 'String',
      name: 'script',
      section: 'scriptSection',
      reactive: false,
      value: '[\n\t\n]', // Is needed so that mementoMgr doesn't get confused on the first state
      preSet: function(o, n) { return n.trim(); },
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 60 }
    },
    {
      class: 'String',
      name: 'aiPrompt',
      section: 'scriptSection',
      label: 'AI Prompt',
      documentation: 'Free-form instruction passed to the AI to generate a Flow script. The service will prepend context from the reflow and foam3 sources and request a raw JSON array representing the flow script.',
      view: { class: 'foam.u2.tag.TextArea', rows: 6, cols: 60 }
    },
    // Interactive AI chat support
    {
      class: 'String',
      name: 'aiMessage',
      section: 'scriptSection',
      label: 'AI Message',
      hidden: true,
      visibility: foam.u2.DisplayMode.HIDDEN
    },
    {
      class: 'StringArray',
      name: 'aiChatEntries',
      hidden: true,
      value: []
    },
    {
      class: 'String',
      name: 'aiChatTranscript',
      section: 'scriptSection',
      label: 'AI Chat',
      hidden: true,
      readPermissionRequired: false,
      writePermissionRequired: false,
      visibility: foam.u2.DisplayMode.HIDDEN,
      expression: function(aiChatEntries) {
        return (aiChatEntries || []).join('\\n');
      },
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 80 }
    },
    {
      class: 'String',
      name: 'aiModel',
      section: 'scriptSection',
      label: 'AI Model',
      value: 'gpt-4o-mini'
    },
    {
      class: 'String',
      name: 'aiChatPanel',
      section: 'scriptSection',
      label: 'AI Conversation (Panel)',
      view: { class: 'foam.core.reflow.FlowAIChatView' }
    },
    {
      class: 'Boolean',
      name: 'aiLoading',
      section: 'scriptSection',
      label: 'AI Loading',
      value: false,
      hidden: true
    },
    {
      class: 'String',
      name: 'aiLoadingMessage',
      section: 'scriptSection',
      label: 'AI Status',
      visibility: function(aiLoading) {
        return aiLoading ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      view: { class: 'foam.u2.tag.TextArea', rows: 2, cols: 60 }
    }
  ],

  methods: [
    {
      name: 'authorizeOnCreate',
      javaCode: `
        // noop
      `
    },
    {
      name: 'checkBypassAuthorization',
      args: `X x`,
      type: 'boolean',
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        return auth.check(x, "*" );
      `
    },
    {
      name: 'authorizeOnRead',
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();
        if ( getCreatedBy() == user.getId() ) return;
        if ( checkBypassAuthorization(x) ) return;

        if ( getAccessLevel() == FlowAccess.PRIVATE ) throw new AuthorizationException();

        if ( getAccessLevel() == FlowAccess.SHARED ) {
          // check user accesss
          if ( getSpecifiedUserAccess() != null ) {
            var hasUserAccess = Arrays.stream(getSpecifiedUserAccess()).anyMatch(o ->
              ((UserFlowAccess) o).getUserId() == user.getId() &&
              (
                ((UserFlowAccess) o).getAccessLevel() == foam.core.reflow.FlowAccess.PUBLIC_RO ||
                ((UserFlowAccess) o).getAccessLevel() == foam.core.reflow.FlowAccess.PUBLIC_RW
              )
            );
            if ( hasUserAccess ) return;
          }

          // check role access
          if ( getSpecifiedRoleAccess() != null ) {
            for ( int i = 0; i < getSpecifiedRoleAccess().length; i++ ) {
              var roleAccess = getSpecifiedRoleAccess()[i];
              // if its not rw/ro don't bother checking
              if ( roleAccess.getAccessLevel() != foam.core.reflow.FlowAccess.PUBLIC_RW &&
                   roleAccess.getAccessLevel() != foam.core.reflow.FlowAccess.PUBLIC_RO ) continue;
              try {
                var hasRolePermission = ((AuthService) x.get("auth")).check(x, this.ROLE_PERMISSION_PREFIX + roleAccess.getRoleId());
                if ( hasRolePermission ) return;
              } catch (AuthorizationException e) { }
            }
          }
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();
        if ( getCreatedBy() == user.getId() ) return;
        if ( checkBypassAuthorization(x) ) return;

        if ( getAccessLevel() == FlowAccess.PRIVATE || getAccessLevel() == FlowAccess.PUBLIC_RO ) throw new AuthorizationException();

        if ( getAccessLevel() == FlowAccess.SHARED ) {
          // check user accesss
          if ( getSpecifiedUserAccess() != null ) {
            var hasUserAccess = Arrays.stream(getSpecifiedUserAccess()).anyMatch(o ->
              ((UserFlowAccess) o).getUserId() == user.getId() && ((UserFlowAccess) o).getAccessLevel() == foam.core.reflow.FlowAccess.PUBLIC_RW
            );
            if ( hasUserAccess ) return;
          }

          // check role access
          if ( getSpecifiedRoleAccess() != null ) {
            for ( int i = 0; i < getSpecifiedRoleAccess().length; i++ ) {
              var roleAccess = getSpecifiedRoleAccess()[i];
              // if its not rw don't bother checking
              if ( roleAccess.getAccessLevel() != foam.core.reflow.FlowAccess.PUBLIC_RW ) continue;
              try {
                var hasRolePermission = ((AuthService) x.get("auth")).check(x, this.ROLE_PERMISSION_PREFIX + roleAccess.getRoleId());
                if ( hasRolePermission ) return;
              } catch (AuthorizationException e) { }
            }
          }
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnDelete',
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();
        if ( getCreatedBy() == user.getId() ) return;
        if ( checkBypassAuthorization(x) ) return;

        if ( getAccessLevel() == FlowAccess.PRIVATE || getAccessLevel() == FlowAccess.PUBLIC_RO ) throw new AuthorizationException();

        if ( getAccessLevel() == FlowAccess.SHARED ) {
          // check user accesss
          if ( getSpecifiedUserAccess() != null ) {
            var hasUserAccess = Arrays.stream(getSpecifiedUserAccess()).anyMatch(o ->
              ((UserFlowAccess) o).getUserId() == user.getId() && ((UserFlowAccess) o).getAccessLevel() == foam.core.reflow.FlowAccess.PUBLIC_RW
            );
            if ( hasUserAccess ) return;
          }

          // check role access
          if ( getSpecifiedRoleAccess() != null ) {
            for ( int i = 0; i < getSpecifiedRoleAccess().length; i++ ) {
              var roleAccess = getSpecifiedRoleAccess()[i];
              // if its not rw don't bother checking
              if ( roleAccess.getAccessLevel() != foam.core.reflow.FlowAccess.PUBLIC_RW ) continue;
              try {
                var hasRolePermission = ((AuthService) x.get("auth")).check(x, this.ROLE_PERMISSION_PREFIX + roleAccess.getRoleId());
                if ( hasRolePermission ) return;
              } catch (AuthorizationException e) { }
            }
          }
          throw new AuthorizationException();
        }
      `
    }
  ],

  actions: [
    {
      name: 'reflow',
      code: function(X) {
        X.routeTo('flow/' + this.name + '?flowMode=PRESENTATION');
      },
      isAvailable: function() {
        // Disable in Reflow, but enable in DAOController (because already in reflow)
        return ! this.__context__.flow;
      }
    },
    {
      name: 'generateScriptFromAI',
      label: 'Generate Script with AI',
      isEnabled: function(aiPrompt) {
        return !! this.aiAsk && !! aiPrompt;
      },
      isAvailable: function() { return false; },
      code: async function(X) {
        try {
          if ( ! this.aiAsk ) {
            this.__subContext__.notify('AI service (aiAsk) is not available.', '', this.__context__.LogLevel.ERROR, true);
            return;
          }
          var current = (this.script || '').trim();
          var base = 'You are assisting with FOAM Reflow Flow editing.\n'
                   + 'Use the ongoing conversation context and the user\'s latest message. If the user says your prior result was wrong or the same as before, correct it and do NOT repeat the earlier output. Only ask a clarifying question if you absolutely cannot proceed.\n'
                   + 'Learn the Flow script JSON format from the provided context files (especially the samples in flow_examples and the schema in flow_schemas/flow.schema.json). Do NOT write FOAM or JavaScript code. Use ScriptDAOAgent ONLY as a last resort if the transformation cannot be expressed in Flow JSON. When referring to DAOs/properties, use the actual model definitions under src/com (e.g., com.paytic.* like MCIFee), and use correct DAO keys (e.g., mciFeeDAO).\n'
                   + 'STRICT SCHEMA COMPLIANCE:\n'
                   + '- Your JSON MUST conform to flow_schemas/flow.schema.json.\n'
                   + '- Use only allowed keys for each block/value/agent; do not invent fields.\n'
                   + '- cmd must be a registered command id from reflow/cmd/cmds.jrl or app/src/com/paytic/flow/cmds.jrl (e.g., h, h1, layout, dao, daofilter, upload, script, test, testresults), optionally with arguments (space or parentheses forms) exactly as used in examples.\n'
                   + '- value.class must be one of the supported classes (Header, Doc, DAOPrompt, DAOFilterPrompt, Script, Test, TestResults, Upload, XHR, LayoutBlock, cells.Cells, cmd.Button.FlowAction, Transform, etc.) and include the correct properties for that class.\n'
                   + '- For agents (GroupByDAOAgent, TableDAOAgent, Min/Max/Avg/SumDAOAgent, GridByDAOAgent, PivotDAOAgent, Column/RowDAOAgent, Count/JSON/CSV/ObjectSelect/Cells/Duplicate/Script), set only documented properties and nest sinks correctly.\n'
                   + 'Output:\n'
                   + '1) A brief, non-technical explanation of what changed (avoid technical/code terms).\n'
                   + '2) The ENTIRE updated Flow script as a JSON array (full script, not a diff or partial), matching the structure used in flow_examples and validated by flow_schemas/flow.schema.json (e.g., flowName, cmd, value, etc.).\n'
                   + 'If a previous script is provided, edit it and include the full updated JSON array.'
                   + (current ? ('\\nPrevious Script (JSON Array):\\n' + current) : '');
          // Default server-side paths for context
          var defaultPaths = [ 'foam3/src/foam/core/reflow', 'foam3/src', 'flow_examples', 'flow_schemas', 'src/com' ];
          var model = 'gemini-2.5-flash'; // mapped to Gemini in ServerAIService
          // Show loading indicator
          this.aiLoading = true;
          this.aiLoadingMessage = 'AI is generating the flow with ' + model + '...';
          // Share session with AIChatView via localStorage
          var sid = null, primed = false;
          try {
            if ( globalThis && globalThis.localStorage ) {
              sid = globalThis.localStorage.getItem('paytic.ai.sessionId');
              primed = globalThis.localStorage.getItem('paytic.ai.sessionPrimed') === 'true';
              if ( ! sid ) {
                sid = (Date.now().toString(36) + Math.random().toString(36).slice(2));
                globalThis.localStorage.setItem('paytic.ai.sessionId', sid);
              }
            }
          } catch (e) {}
          var moduleWithSession = sid ? ('reflow#' + sid) : 'reflow';
          // If session primed, avoid resending heavy paths
          var pathsToSend = primed ? [] : defaultPaths;
          var response = await this.aiAsk.ask(X, base, pathsToSend, moduleWithSession, model);
          if ( ! response ) {
            this.__subContext__.notify('AI returned empty response.', '', this.__context__.LogLevel.WARN, true);
            return;
          }
          // Extract JSON array between the first '[' and the last ']'
          var s = response.indexOf('[');
          var e = response.lastIndexOf(']');
          var jsonText = (s >= 0 && e >= s) ? response.substring(s, e + 1) : '';
          var explanation = (function() {
            if ( s >= 0 && e >= s ) {
              var before = response.slice(0, s).trim();
              var after  = response.slice(e + 1).trim();
              var msg = (before + (before && after ? ' ' : '') + after).trim();
              return msg || 'Updated the flow based on your request.';
            }
            return response.trim();
          })();
          if ( jsonText ) this.script = jsonText;
          this.__subContext__.notify(explanation || 'Script generated from AI.', '', this.__context__.LogLevel.INFO, false);
        } catch (e) {
          var msg = (e && e.message) ? e.message : ('' + e);
          this.__subContext__.notify('AI generation failed: ' + msg, '', this.__context__.LogLevel.ERROR, true);
        } finally {
          this.aiLoading = false;
          this.aiLoadingMessage = '';
        }
      }
    }
    ,
    {
      name: 'aiSend',
      label: 'AI Chat: Send',
      section: 'scriptSection',
      isAvailable: function() { return false; },
      isEnabled: function(aiMessage) { return !! this.aiAsk && !! aiMessage; },
      code: async function(X) {
        try {
          if ( ! this.aiAsk ) {
            this.__subContext__.notify('AI service (aiAsk) is not available.', '', this.__context__.LogLevel.ERROR, true);
            return;
          }
          var userMsg = (this.aiMessage || '');
          // Build pre-prompt including current script for editing
          var current = (this.script || '').trim();
          var base = 'You are assisting with FOAM Reflow Flow editing.\n'
                   + 'Use the ongoing conversation context and the user\'s latest message. If the user says your prior result was wrong or the same as before, fix it and do NOT repeat the earlier output. Only ask a clarifying question if you absolutely cannot proceed.\n'
                   + 'Learn the Flow script JSON format from the provided context files (especially the samples in flow_examples and the schema in flow_schemas/flow.schema.json). Do NOT write FOAM or JavaScript code. Use ScriptDAOAgent ONLY as a last resort if the transformation cannot be expressed in Flow JSON. When referring to DAOs/properties, use the actual model definitions under src/com (e.g., com.paytic.* like MCIFee), and use correct DAO keys (e.g., mciFeeDAO).\n'
                   + 'STRICT SCHEMA COMPLIANCE:\n'
                   + '- Your JSON MUST conform to flow_schemas/flow.schema.json.\n'
                   + '- Use only allowed keys for each block/value/agent; do not invent fields.\n'
                   + '- cmd must be a registered command id from reflow/cmd/cmds.jrl or app/src/com/paytic/flow/cmds.jrl (e.g., h, h1, layout, dao, daofilter, upload, script, test, testresults), optionally with arguments (space or parentheses forms) exactly as used in examples.\n'
                   + '- value.class must be one of the supported classes (Header, Doc, DAOPrompt, DAOFilterPrompt, Script, Test, TestResults, Upload, XHR, LayoutBlock, cells.Cells, cmd.Button.FlowAction, Transform, etc.) and include the correct properties for that class.\n'
                   + '- For agents (GroupByDAOAgent, TableDAOAgent, Min/Max/Avg/SumDAOAgent, GridByDAOAgent, PivotDAOAgent, Column/RowDAOAgent, Count/JSON/CSV/ObjectSelect/Cells/Duplicate/Script), set only documented properties and nest sinks correctly.\n'
                   + 'Output:\n'
                   + '1) A brief, non-technical explanation of the change (avoid technical/code terms).\n'
                   + '2) The ENTIRE updated Flow script as a JSON array (full script, not a diff or partial), matching the structure used in flow_examples and validated by flow_schemas/flow.schema.json (e.g., flowName, cmd, value, etc.).\n'
                   + (current ? ('\\nCurrent Script (JSON Array):\\n' + current + '\\n') : '')
                   + 'User instruction:\\n' + userMsg;
          var defaultPaths = [ 'foam3/src/foam/core/reflow', 'foam3/src', 'flow_examples', 'flow_schemas', 'src/com' ];
          var model = (this.aiModel || 'gemini-2.5-flash');
          // Show loading indicator
          this.aiLoading = true;
          this.aiLoadingMessage = 'AI is updating the flow with ' + model + '...';
          // Share session with AIChatView via localStorage
          var sid = null, primed = false;
          try {
            if ( globalThis && globalThis.localStorage ) {
              sid = globalThis.localStorage.getItem('paytic.ai.sessionId');
              primed = globalThis.localStorage.getItem('paytic.ai.sessionPrimed') === 'true';
              if ( ! sid ) {
                sid = (Date.now().toString(36) + Math.random().toString(36).slice(2));
                globalThis.localStorage.setItem('paytic.ai.sessionId', sid);
              }
            }
          } catch (e) {}
          var moduleWithSession = sid ? ('reflow#' + sid) : 'reflow';
          var pathsToSend = primed ? [] : defaultPaths;
          this.aiChatEntries = (this.aiChatEntries || []).concat([ 'You: ' + userMsg ]);
          var reply = await this.aiAsk.ask(X, base, pathsToSend, moduleWithSession, model);
          if ( reply && typeof reply === 'string' ) {
            // Extract JSON array and explanation-only text
            var s = reply.indexOf('['), e = reply.lastIndexOf(']');
            var explanation = (function() {
              if ( s >= 0 && e >= s ) {
                var before = reply.slice(0, s).trim();
                var after  = reply.slice(e + 1).trim();
                var msg = (before + (before && after ? ' ' : '') + after).trim();
                return msg || 'Updated the flow based on your request.';
              }
              return reply.trim();
            })();
            this.aiChatEntries = (this.aiChatEntries || []).concat([ 'AI: ' + explanation ]);
            if ( s >= 0 && e >= s ) {
              var arr = reply.substring(s, e+1);
              if ( arr.trim().startsWith('[') ) this.script = arr;
            }
          } else {
            this.aiChatEntries = (this.aiChatEntries || []).concat([ 'AI: [empty reply]' ]);
          }
          this.aiMessage = '';
        } catch (e) {
          var msg = (e && e.message) ? e.message : ('' + e);
          this.__subContext__.notify('AI chat failed: ' + msg, '', this.__context__.LogLevel.ERROR, true);
        } finally {
          this.aiLoading = false;
          this.aiLoadingMessage = '';
        }
      }
    }
  ]
});
