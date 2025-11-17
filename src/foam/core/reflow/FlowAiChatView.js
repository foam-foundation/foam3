foam.CLASS({
    package: 'foam.core.reflow',
    name: 'FlowAIChatView',
    extends: 'foam.u2.View',
    documentation: 'Interactive AI chat panel for Flow with visible context paths and raw replies.',

    properties: [
        { class: 'StringArray', name: 'logs', value: [] },
        { class: 'StringArray', name: 'contextPaths', factory: function() {
        return [ 'foam3/src/foam/core/reflow', 'foam3/src', 'flow_examples', 'flow_schemas', 'src/com' ];
        } },
        { class: 'Boolean', name: 'isPrimed', value: false },
        { class: 'String', name: 'sessionId' },
        { class: 'String', name: 'prompt' },
        { class: 'Boolean', name: 'autoFixing', value: false }
    ],

    methods: [
        function validateAndAnnotate(jsonText) {
        // Validation temporarily disabled: accept any JSON, pretty-print if possible.
        var errors = [];
        var warnings = [];
        var parsed = null;
        function levenshtein(a, b) {
            a = (a||'')+''; b = (b||'')+'';
            var m = a.length, n = b.length;
            if (m === 0) return n;
            if (n === 0) return m;
            var dp = new Array(n + 1);
            for (var j = 0; j <= n; j++) dp[j] = j;
            for (var i = 1; i <= m; i++) {
            var prev = dp[0]; dp[0] = i;
            for (var j = 1; j <= n; j++) {
                var temp = dp[j];
                if (a.charCodeAt(i - 1) === b.charCodeAt(j - 1)) dp[j] = prev;
                else dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
                prev = temp;
            }
            }
            return dp[n];
        }
        function suggestClosest(name, candidates) {
            if (!candidates || !candidates.length) return null;
            var best = null, bestD = 1e9;
            candidates.forEach(function(c){
            var d = levenshtein((name||'').toLowerCase(), (c||'').toLowerCase());
            if (d < bestD) { bestD = d; best = c; }
            });
            return best;
        }
        try { parsed = JSON.parse(jsonText); } catch (e) {}
        var ok = true;
        // basic schema-like checks
        var allowedBlockKeys = { flowName:1, cmd:1, value:1, borderClass:1, border:1 };
        var self = this;
        function pushErr(path, msg, hintKey) { errors.push({ path: path.slice(), message: msg, hintKey: hintKey||null }); }
        function pushWarn(path, msg, hintKey) { warnings.push({ path: path.slice(), message: msg, hintKey: hintKey||null }); }
        function validatePropRef(obj, path) {
            if ( !obj || obj.class !== '__Property__' ) { pushErr(path, 'Expected PropertyRef with class="__Property__"', 'class'); return; }
            if ( !obj.forClass_ ) pushErr(path, 'Missing forClass_', 'forClass_');
            if ( !obj.name ) pushErr(path, 'Missing property name', 'name');
            // try runtime validation if class is loaded
            if ( obj.forClass_ && obj.name && typeof foam !== 'undefined' && foam.lookup ) {
            var cls = null;
            try { cls = foam.lookup(obj.forClass_, true); } catch (e) { cls = null; }
            if ( ! cls ) {
                var simple = (obj.forClass_.split('.').pop() || '').toLowerCase();
                var guesses = [];
                try {
                var alt = foam.lookup('com.paytic.nf.' + (simple.charAt(0).toUpperCase() + simple.slice(1)), true);
                if ( alt ) { cls = alt; guesses.push(alt.id); }
                } catch(e){}
                if ( ! cls ) pushErr(path.concat(['forClass_']), 'Unknown model class: ' + obj.forClass_ + (guesses.length ? (' (did you mean ' + guesses.join(', ') + '?)') : ''), 'forClass_');
            }
            if ( cls ) {
                var propNames = [];
                try {
                if ( cls.getAxiomsByClass && foam.lang && foam.lang.Property ) {
                    var ax = cls.getAxiomsByClass(foam.lang.Property) || [];
                    propNames = ax.map(function(a){ return a.name; });
                } else {
                    propNames = Object.keys(cls.axiomMap_ || {});
                }
                } catch (e) {
                propNames = Object.keys(cls.axiomMap_ || {});
                }
                if ( ! cls.getAxiomByName || ! cls.getAxiomByName(obj.name) ) {
                var suggestion = suggestClosest(obj.name, propNames);
                pushErr(path.concat(['name']), 'Unknown property on ' + (cls.id || obj.forClass_) + ': ' + obj.name + (suggestion ? (' (did you mean "' + suggestion + '"?)') : ''), 'name');
                }
            }
            }
        }
        function validateAgent(agent, path) {
            if ( !agent || !agent.class ) { pushErr(path, 'Agent missing "class"', 'class'); return; }
            var c = agent.class;
            function ensureKeys(allowed, required) {
            Object.keys(agent).forEach(function(k){ if ( !allowed[k] ) pushErr(path.concat([k]), 'Unknown key "'+k+'" for '+c, k); });
            (required||[]).forEach(function(k){ if ( agent[k] === undefined ) pushErr(path, 'Missing required key "'+k+'" for '+c, k); });
            }
            if ( c === 'foam.core.reflow.ScriptDAOAgent' ) {
            // Allow but warn, and require "code"
            ensureKeys({ class:1, code:1 }, ['class','code']);
            pushWarn(path.concat(['class']), 'Using ScriptDAOAgent as a last resort. Prefer declarative DAO agents where possible.', 'class');
            if ( agent.code === '' ) pushWarn(path.concat(['code']), 'Empty code block in ScriptDAOAgent', 'code');
            return;
            }
            if ( c === 'foam.core.reflow.TableDAOAgent' ) {
            ensureKeys({ class:1, columns:1, groupBy:1 }, ['class']);
            if ( agent.groupBy ) validatePropRef(agent.groupBy, path.concat(['groupBy']));
            } else if ( c === 'foam.core.reflow.GroupByDAOAgent' ) {
            ensureKeys({ class:1, prop:1, sink:1, topN:1, includeOthers:1, sortOrder:1, othersLabel:1, groupLimit:1 }, ['class','prop','sink']);
            if ( 'browseEnabled' in agent ) pushErr(path.concat(['browseEnabled']), 'browseEnabled is not allowed here', 'browseEnabled');
            if ( agent.prop ) validatePropRef(agent.prop, path.concat(['prop']));
            if ( agent.sink ) validateAgent(agent.sink, path.concat(['sink']));
            if ( agent.sortOrder && ['ASC','DESC'].indexOf(agent.sortOrder) === -1 ) pushErr(path.concat(['sortOrder']), 'sortOrder must be ASC or DESC', 'sortOrder');
            } else if ( c === 'foam.core.reflow.MinDAOAgent' || c === 'foam.core.reflow.MaxDAOAgent' || c === 'foam.core.reflow.AvgDAOAgent' || c === 'foam.core.reflow.SumDAOAgent' ) {
            ensureKeys({ class:1, prop:1 }, ['class','prop']);
            if ( agent.prop ) validatePropRef(agent.prop, path.concat(['prop']));
            } else if ( c === 'foam.core.reflow.GridByDAOAgent' ) {
            ensureKeys({ class:1, prop1:1, prop2:1, sink:1 }, ['class','prop1','prop2','sink']);
            if ( agent.prop1 ) validatePropRef(agent.prop1, path.concat(['prop1']));
            if ( agent.prop2 ) validatePropRef(agent.prop2, path.concat(['prop2']));
            if ( agent.sink ) validateAgent(agent.sink, path.concat(['sink']));
            } else if ( c === 'foam.core.reflow.PivotDAOAgent' ) {
            ensureKeys({ class:1, xProps:1, yProps:1, sink:1 }, ['class']);
            if ( agent.sink ) validateAgent(agent.sink, path.concat(['sink']));
            } else if ( c === 'foam.core.reflow.ColumnDAOAgent' || c === 'foam.core.reflow.RowDAOAgent' ) {
            ensureKeys({ class:1, sinks:1 }, ['class','sinks']);
            if ( Array.isArray(agent.sinks) ) {
                agent.sinks.forEach(function(s, idx){ validateAgent(s, path.concat(['sinks', idx])); });
            } else {
                pushErr(path.concat(['sinks']), 'sinks must be an array', 'sinks');
            }
            } else {
            // Allow simple sinks without extra keys
            ensureKeys({ class:1 }, ['class']);
            }
        }
        function validateValue(val, path) {
            if ( !val || !val.class ) { pushErr(path, 'value missing "class"', 'class'); return; }
            if ( val.class === 'foam.core.reflow.DAOPrompt' ) {
            var allowed = { class:1, label:1, where:1, aql:1, order:1, columns:1, labelVisible:1, autoRun:1, select:1 };
            Object.keys(val).forEach(function(k){ if ( !allowed[k] ) pushErr(path.concat([k]), 'Unknown key "'+k+'" for '+val.class, k); });
            if ( val.select ) validateAgent(val.select, path.concat(['select']));
            } else {
            // unknown value class: allow but warn
            //pushErr(path.concat(['class']), 'Unrecognized value class: ' + val.class, 'class');
            }
        }
        if ( Array.isArray(parsed) ) {
            parsed.forEach(function(block, i){
            var bp = [i];
            if ( typeof block !== 'object' || !block ) { pushErr(bp, 'Block must be an object', null); return; }
            if ( typeof block.flowName !== 'string' ) pushErr(bp.concat(['flowName']), 'flowName must be a string', 'flowName');
            if ( typeof block.cmd !== 'string' ) pushErr(bp.concat(['cmd']), 'cmd must be a string', 'cmd');
            Object.keys(block).forEach(function(k){ if ( !allowedBlockKeys[k] ) pushErr(bp.concat([k]), 'Unknown key "'+k+'" on block', k); });
            if ( block.value ) validateValue(block.value, bp.concat(['value']));
            // Heuristic: validate "dao <name>" in cmd
            if ( typeof block.cmd === 'string' ) {
                var m = /^\\s*dao\\s+([A-Za-z0-9_.$-]+)\\s*$/.exec(block.cmd);
                if ( m ) {
                var daoKey = m[1];
                // Try to guess correct DAO name from any PropertyRef classes found in this block
                var refs = [];
                function collectRefs(agent) {
                    if ( !agent || typeof agent !== 'object' ) return;
                    if ( agent.prop && agent.prop.class === '__Property__' ) refs.push(agent.prop.forClass_);
                    if ( agent.prop1 && agent.prop1.class === '__Property__' ) refs.push(agent.prop1.forClass_);
                    if ( agent.prop2 && agent.prop2.class === '__Property__' ) refs.push(agent.prop2.forClass_);
                    if ( agent.sink ) collectRefs(agent.sink);
                    if ( Array.isArray(agent.sinks) ) agent.sinks.forEach(collectRefs);
                }
                if ( block.value && block.value.select ) collectRefs(block.value.select);
                var suggestions = [];
                refs.forEach(function(fc){
                    var simple = (fc || '').split('.').pop();
                    if ( simple ) suggestions.push(simple.charAt(0).toLowerCase() + simple.slice(1) + 'DAO');
                });
                var unique = Array.from(new Set(suggestions));
                // If any suggestion distance is small, propose it
                var candidate = suggestClosest(daoKey, unique);
                // Add generic camel-case normalization too
                if ( !candidate && daoKey ) {
                    var c2 = daoKey.replace(/DAO$/,'');
                    if ( c2 ) candidate = c2.charAt(0).toLowerCase() + c2.slice(1) + 'DAO';
                }
                // If context exposes the DAO key, don't warn/error
                var ctx = (self.__subContext__ || self.__context__ || {});
                if ( !ctx[daoKey] ) {
                    // Can't verify existence here: treat as WARNING with suggestion
                    pushWarn(bp.concat(['cmd']), 'DAO key "' + daoKey + '" not recognized in current context' + (candidate ? (' (did you mean "' + candidate + '"?)') : ''), 'cmd');
                }
                }
            }
            });
        }
        // pretty print
        var pretty = jsonText;
        try { if ( parsed ) pretty = JSON.stringify(parsed, null, 2); } catch (e) {}
        // annotate by inserting comments before offending keys
        function annotateWith(prefix, items, text) {
            var lines = text.split('\n');
            function insertCommentForKey(key, msg) {
            for ( var i = 0; i < lines.length; i++ ) {
                if ( lines[i].match(new RegExp('^\\s*"'+ key.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&') + '"\\s*:')) ) {
                lines.splice(i, 0, prefix + ': ' + msg);
                return true;
                }
            }
            lines.unshift(prefix + ': ' + msg);
            return false;
            }
            items.forEach(function(e){
            if ( e.hintKey ) insertCommentForKey(e.hintKey, e.message);
            else lines.unshift(prefix + ': ' + e.message);
            });
            return lines.join('\n');
        }
        var annotatedErrors = pretty;
        var annotatedWarn = pretty;
        return { ok: true, errors: [], warnings: [], pretty: pretty, annotated: annotatedErrors, annotatedWarn: annotatedWarn };
        },
        function render() {
        this.SUPER();
        var self = this;
        // Initialize session and primed flags from localStorage
        try {
            if ( globalThis && globalThis.localStorage ) {
            var sid = globalThis.localStorage.getItem('paytic.ai.sessionId');
            if ( ! sid ) {
                sid = (Date.now().toString(36) + Math.random().toString(36).slice(2));
                globalThis.localStorage.setItem('paytic.ai.sessionId', sid);
            }
            this.sessionId = sid;
            this.isPrimed = globalThis.localStorage.getItem('paytic.ai.sessionPrimed') === 'true';
            }
        } catch (e) {}
        // Initialize from Flow.aiChatEntries to preserve history across re-renders
        try {
            var flowForInit = (this.data && this.data.cls_) ? this.data :
                            (this.__context__ && this.__context__.data && this.__context__.data.cls_ ? this.__context__.data : null);
            if ( flowForInit && Array.isArray(flowForInit.aiChatEntries) && flowForInit.aiChatEntries.length && (! this.logs || this.logs.length === 0) ) {
            this.logs = flowForInit.aiChatEntries.slice();
            }
        } catch (e) {}

        var header = this.E().style({ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' })
            .add('Session: ')
            .add(this.slot(function(sessionId) { return sessionId || '(none)'; }.bind(this), this.sessionId$))
            .add(' | Primed: ')
            .add(this.slot(function(isPrimed) { return isPrimed ? 'yes' : 'no'; }.bind(this), this.isPrimed$));

        // Paths list with send status
        var pathsBlock = this.E().style({ border: '1px solid #ddd', borderRadius: '8px', padding: '8px', background: '#fafafa', marginBottom: '8px' })
            .start('div').style({ fontWeight: '600', marginBottom: '4px' }).add('Context Files (will send this turn):').end()
            .add(this.slot(function(isPrimed, contextPaths) {
            var E = self.E();
            var willSend = isPrimed ? [] : contextPaths;
            if ( willSend.length === 0 ) {
                E.add('(none this turn; session already primed)').br();
            } else {
                willSend.forEach(function(p) { E.start('div').add('✓ ').add(p).end(); });
            }
            // Also show full context set for clarity
            E.start('div').style({ marginTop: '6px' }).add('All default context paths: ').end();
            E.start('div').style({ fontFamily: 'monospace', fontSize: '12px' }).add(contextPaths.join(', ')).end();
            return E;
            }, this.isPrimed$, this.contextPaths$));

        // Prompt area (kept as-is; not cleared on send)
        var promptArea = this.E()
            .start('div').style({ fontWeight: '600', marginBottom: '4px' }).add('Your prompt: (kept as-is)').end()
            .tag(this.PROMPT, { onKey: true, view: { class: 'foam.u2.tag.TextArea', rows: 6 } });

        // Send button
        var sendBtn = this.E().start('div').style({ marginTop: '8px', marginBottom: '8px' })
            .start('button')
            .add('Send')
            .on('click', async () => {
                try {
                var X = this.__subContext__ || this;
                var svc = X.aiAsk;
                if ( ! svc ) {
                    this.logs = this.logs.concat([ 'Error: aiAsk service not available in context' ]);
                    return;
                }
                // Try to resolve parent Flow object; fallback to property value if needed
                var flow = (this.data && this.data.cls_) ? this.data :
                            (this.__context__ && this.__context__.data && this.__context__.data.cls_ ? this.__context__.data : null);
                var model = (flow && flow.aiModel) ? flow.aiModel : 'gpt-4o-mini';
                var current = (flow && flow.script) ? (flow.script || '').trim() : '';
                var baseInstruction = (flow && flow.aiPrompt) ? (flow.aiPrompt || '').trim() : '';
                var panelMsg = (this.prompt || '').trim();
                var userMsg = (panelMsg && baseInstruction) ? (baseInstruction + '\n' + panelMsg)
                            : (panelMsg || baseInstruction);
                // Build base like Flow.aiSend, but keep raw reply and do not auto-apply
                var base = 'You are assisting with FOAM Reflow Flow editing.\n'
                        + 'Use the ongoing conversation context and the user\'s latest message. If the user says your prior result was wrong or the same as before, fix it and do NOT repeat the earlier output. Only ask a clarifying question if you absolutely cannot proceed.\n'
                        + 'Learn the Flow script JSON format from the provided context files (especially the samples in flow_examples and the schema in flow_schemas/flow.schema.json). Do NOT write FOAM or JavaScript code. Never use ScriptDAOAgent. When referring to DAOs/properties, use the actual model definitions under src/com (e.g., com.paytic.* like MCIFee), and use correct DAO keys (e.g., mciFeeDAO).\n'
                        + 'STRICT SCHEMA COMPLIANCE:\n'
                        + '- Your JSON MUST conform to flow_schemas/flow.schema.json.\n'
                        + '- Use only allowed keys for each block/value/agent; do not invent fields.\n'
                        + '- cmd must be a registered command id from reflow/cmd/cmds.jrl or app/src/com/paytic/flow/cmds.jrl (e.g., h, h1, layout, dao, daofilter, upload, script, test, testresults), optionally with arguments (space or parentheses forms) exactly as used in examples.\n'
                        + '- value.class must be one of the supported classes (Header, Doc, DAOPrompt, DAOFilterPrompt, Script, Test, TestResults, Upload, XHR, LayoutBlock, cells.Cells, cmd.Button.FlowAction, Transform, etc.) and include the correct properties for that class.\n'
                        + '- For agents (GroupByDAOAgent, TableDAOAgent, Min/Max/Avg/SumDAOAgent, GridByDAOAgent, PivotDAOAgent, Column/RowDAOAgent, Count/JSON/CSV/ObjectSelect/Cells/Duplicate/Script), set only documented properties and nest sinks correctly.\n'
                        + 'Output (STRICT):\n'
                        + '1) A brief, non-technical explanation of the change (avoid technical/code terms).\n'
                        + '2) The ENTIRE updated Flow script as a JSON array (full script, not a diff or partial), matching the structure used in flow_examples and validated by flow_schemas/flow.schema.json (e.g., flowName, cmd, value, etc.).\n'
                        + 'Do NOT wrap the JSON array in Markdown/code fences. Print it raw starting with [ and ending with ].\n'
                        + (current ? ('\nCurrent Script (JSON Array):\n' + current + '\n') : '')
                        + 'User instruction:\n' + userMsg;

                var moduleWithSession = this.sessionId ? ('reflow#' + this.sessionId) : 'reflow';
                var pathsToSend = this.isPrimed ? [] : this.contextPaths;
                this.logs = this.logs.concat([ 'You: ' + userMsg ]);
                var reply = await svc.ask(X, base, pathsToSend, moduleWithSession, model);
                if ( reply && typeof reply === 'string' ) {
                    // Extract explanation and JSON array
                    var si = reply.indexOf('['), ei = reply.lastIndexOf(']');
                    var explanation = '';
                    var jsonText = '';
                    if ( si >= 0 && ei >= si ) {
                    explanation = (reply.slice(0, si).trim() + ' ' + reply.slice(ei + 1).trim()).trim();
                    jsonText = reply.substring(si, ei + 1);
                    } else {
                    explanation = reply.trim();
                    }
                    // Pretty print if possible
                    var newLogs = [];
                    if ( userMsg ) newLogs.push('You: ' + userMsg);
                    if ( explanation ) newLogs.push('AI: ' + explanation);
                    if ( jsonText ) {
                    var vr = this.validateAndAnnotate(jsonText);
                    if ( vr.ok ) {
                        // Show warnings inline if any
                        var toShow = vr.warnings && vr.warnings.length ? vr.annotatedWarn : vr.pretty;
                        newLogs.push('AI_JSON:' + toShow);
                        if ( flow ) flow.script = jsonText;
                    } else {
                        newLogs.push('AI_JSON_ERR:' + vr.annotated);
                        // auto re-prompt once to fix
                        if ( ! this.autoFixing ) {
                        this.autoFixing = true;
                        var fixPrompt = 'Your last JSON Flow script had validation errors (see comments inline). Please fix all issues and return ONLY the full JSON array starting with [ and ending with ]. Prefer declarative DAO agents (GroupByDAOAgent, SumDAOAgent, etc.). Use ScriptDAOAgent ONLY if the transformation cannot be expressed in Flow JSON.\n' + vr.annotated;
                        this.logs = (this.logs || []).concat(newLogs);
                        try {
                            var fixModel = (model && model.toLowerCase() === 'gpt-4o-mini') ? 'gpt-5' : model;
                            var fixReply = await svc.ask(X, base, [], moduleWithSession, fixModel);
                            var fsi = fixReply.indexOf('['), fei = fixReply.lastIndexOf(']');
                            var fj = (fsi>=0 && fei>=fsi) ? fixReply.substring(fsi, fei+1) : '';
                            if ( fj ) {
                            var fvr = this.validateAndAnnotate(fj);
                            if ( fvr.ok ) {
                                this.logs = this.logs.concat([ 'AI (fix): ' + fixReply.slice(0, fsi).trim() ]);
                                this.logs = this.logs.concat([ 'AI_JSON:' + fvr.pretty ]);
                                if ( flow ) flow.script = fj;
                            } else {
                                this.logs = this.logs.concat([ 'AI (fix): ' + fixReply.slice(0, fsi).trim() ]);
                                this.logs = this.logs.concat([ 'AI_JSON_ERR:' + fvr.annotated ]);
                            }
                            } else {
                            this.logs = this.logs.concat([ 'AI (fix): ' + fixReply ]);
                            }
                        } catch (fixErr) {
                            this.logs = this.logs.concat([ 'Error during auto-fix: ' + (fixErr && fixErr.message ? fixErr.message : fixErr) ]);
                        } finally {
                            this.autoFixing = false;
                        }
                        // mark primed if we sent any paths
                        if ( pathsToSend && pathsToSend.length ) {
                            this.isPrimed = true;
                            try { if ( globalThis && globalThis.localStorage ) globalThis.localStorage.setItem('paytic.ai.sessionPrimed', 'true'); } catch (e) {}
                        }
                        // Persist after fix phase
                        try { if ( flow ) flow.aiChatEntries = (this.logs || []).slice(-200); } catch (e) {}
                        return;
                        }
                    }
                    } else {
                    // Retry with stronger model if mini struggled
                    if ( ! this.autoFixing && model && model.toLowerCase() === 'gpt-4o-mini' ) {
                        this.autoFixing = true;
                        try {
                        var retryReply = await svc.ask(X, base, [], moduleWithSession, 'gpt-5');
                        var rsi = retryReply.indexOf('['), rei = retryReply.lastIndexOf(']');
                        var rj = (rsi>=0 && rei>=rsi) ? retryReply.substring(rsi, rei+1) : '';
                        if ( rj ) {
                            var rvr = this.validateAndAnnotate(rj);
                            if ( rvr.ok ) {
                            this.logs = this.logs.concat([ 'AI (retry): ' + retryReply.slice(0, rsi).trim() ]);
                            this.logs = this.logs.concat([ 'AI_JSON:' + (rvr.warnings && rvr.warnings.length ? rvr.annotatedWarn : rvr.pretty) ]);
                            if ( flow ) flow.script = rj;
                            } else {
                            this.logs = this.logs.concat([ 'AI (retry): ' + retryReply.slice(0, rsi).trim() ]);
                            this.logs = this.logs.concat([ 'AI_JSON_ERR:' + rvr.annotated ]);
                            }
                        } else {
                            this.logs = this.logs.concat([ 'AI (retry): ' + retryReply ]);
                        }
                        } catch (e) {
                        this.logs = this.logs.concat([ 'Error during retry: ' + (e && e.message ? e.message : e) ]);
                        } finally {
                        this.autoFixing = false;
                        }
                    } else {
                        newLogs.push('AI: [no JSON detected]');
                    }
                    }
                    this.logs = (this.logs || []).concat(newLogs);
                    // Persist logs back to Flow.aiChatEntries to survive re-renders
                    try {
                    if ( flow ) flow.aiChatEntries = this.logs.slice(-200); // cap
                    } catch (e) {}
                    // mark primed if we sent any paths
                    if ( pathsToSend && pathsToSend.length ) {
                    this.isPrimed = true;
                    try { if ( globalThis && globalThis.localStorage ) globalThis.localStorage.setItem('paytic.ai.sessionPrimed', 'true'); } catch (e) {}
                    }
                } else {
                    this.logs = this.logs.concat([ 'AI: [empty reply]' ]);
                    try { if ( flow ) flow.aiChatEntries = this.logs.slice(-200); } catch (e) {}
                }
                } catch (e) {
                this.logs = this.logs.concat([ 'Error: ' + (e && e.message ? e.message : e) ]);
                try { if ( flow ) flow.aiChatEntries = this.logs.slice(-200); } catch (ex) {}
                }
            })
            .end()
        .end();

        // Logs
        var logsArea = this.E().style({ border: '1px solid #ddd', borderRadius: '8px', padding: '8px', background: '#fff', height: '40vh', overflow: 'auto', fontFamily: 'monospace', fontSize: '12px' })
            .add(this.slot(function(logs) {
            var E = self.E();
            (logs || []).forEach(function(l) {
                if ( typeof l === 'string' && l.indexOf('AI_JSON:') === 0 ) {
                var json = l.substring('AI_JSON:'.length);
                E.start('details').style({ margin: '6px 0', padding: '4px 6px', background: '#f7f7f7', border: '1px solid #eee', borderRadius: '6px' })
                    .start('summary').style({ cursor: 'pointer', fontWeight: '600' }).add('AI JSON (click to expand)').end()
                    .start('pre').style({ margin: 0, padding: '8px', whiteSpace: 'pre-wrap' }).add(json).end()
                .end();
                } else if ( typeof l === 'string' && l.indexOf('AI_JSON_ERR:') === 0 ) {
                var jerr = l.substring('AI_JSON_ERR:'.length);
                E.start('details').style({ margin: '6px 0', padding: '4px 6px', background: '#fff5f5', border: '1px solid #e53e3e', borderRadius: '6px' })
                    .start('summary').style({ cursor: 'pointer', fontWeight: '700', color: '#c53030' }).add('AI JSON (errors, click to expand)').end()
                    .start('pre').style({ margin: 0, padding: '8px', whiteSpace: 'pre-wrap', color: '#742a2a' }).add(jerr).end()
                .end();
                } else {
                E.start('div').add(l).end();
                }
            });
            return E;
            }, this.logs$));

        // Loading spinner overlay if AI is running
        var aiLoading = flowForInit && flowForInit.aiLoading;
        var loadingMsg = (flowForInit && flowForInit.aiLoadingMessage) || ((this.data && this.data.aiLoadingMessage) ? this.data.aiLoadingMessage : 'Waiting for AI response...');
        var loadingUI = aiLoading ? this.E().style({position: 'absolute', right: '32px', top: '16px', zIndex: 1000, display:'flex',alignItems:'center',gap:'12px'})
          .add(this.E().start('div').style({ width: '22px', height: '22px', border: '3px solid #cee', borderTop: '3px solid #90caf9', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '8px' })
          .addClass('loadingSpinner').end())
          .add(this.E().start('span').style({fontWeight:'bold', color:'#1976d2'}).add(loadingMsg).end())
          .toE() : null;

        this.add(
            this.E().style({ display: 'flex', gap: '16px', position: 'relative' })
            .start('div').style({ flex: 1, position: 'relative' })
                .add(header)
                .add(pathsBlock)
                .add(promptArea)
                .add(sendBtn)
                .add(loadingUI || this.E())
            .end()
            .start('div').style({ flex: 1 })
                .add(logsArea)
            .end()
        );
        // Add CSS keyframes for the spinner
        var style = document.createElement('style');
        style.innerHTML = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
        if (!document.head.querySelector('style[data-flow-ai-spinner]')) {
          style.setAttribute('data-flow-ai-spinner', '1');
          document.head.appendChild(style);
        }
        }
    ]
});


