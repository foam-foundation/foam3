/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'LSPIntegrationTest',
  extends: 'foam.core.test.JSTest',

  methods: [
    async function runTest(x) {
      // Test the full request/response cycle without spawning a process.
      // We test the end-to-end handler chain directly.

      var index   = foam.parse.lsp.FoamIndex.create();
      var grammar = foam.parse.lsp.FoamClassGrammar.create({ index: index });

      var completionHandler  = foam.parse.lsp.handlers.CompletionHandler.create({ index: index, grammar: grammar });
      var hoverHandler       = foam.parse.lsp.handlers.HoverHandler.create({ index: index });
      var definitionHandler  = foam.parse.lsp.handlers.DefinitionHandler.create({ index: index });
      var diagnosticsHandler = foam.parse.lsp.handlers.DiagnosticsHandler.create({ index: index });
      var symbolHandler      = foam.parse.lsp.handlers.SymbolHandler.create();
      var memberHandler      = foam.parse.lsp.handlers.MemberCompletionHandler.create({ index: index });

      var testFile = "foam.CLASS({\n  package: 'test.integration',\n  name: 'TestModel',\n  extends: 'foam.lang.FObject',\n  properties: [\n    { class: 'String', name: 'firstName' },\n    'lastName'\n  ],\n  methods: [\n    function greet() {\n      this.\n      return 'hello';\n    }\n  ]\n})";

      // Completion: property type
      var c1 = completionHandler.handle(
        "foam.CLASS({\n  properties: [\n    { class: '",
        { line: 2, character: 14 }
      );
      x.test(c1.items.length > 5, 'Integration: completion returns property types');

      // Hover: class in extends
      var h1 = hoverHandler.handle(testFile, { line: 3, character: 20 });
      x.test(h1 != null, 'Integration: hover returns info for FObject');

      // Definition: extends class
      var d1 = definitionHandler.handle(testFile, { line: 3, character: 20 });
      x.test(d1 != null, 'Integration: definition returns location for FObject');

      // Diagnostics: valid file
      var diag1 = diagnosticsHandler.handle(testFile);
      var errors = diag1.filter(function(d) { return d.severity === 1; });
      x.test(errors.length === 0, 'Integration: valid file has no errors');

      // Symbols: outline
      var s1 = symbolHandler.handle(testFile);
      x.test(s1.length >= 3, 'Integration: symbols include class + properties + methods');

      // Member completion: this.
      var m1 = memberHandler.handle(testFile, { line: 10, character: 11 });
      x.test(m1.items.length > 0, 'Integration: member completion returns items');

      // Semantic tokens: scope-aware
      var semanticHandler = foam.parse.lsp.handlers.SemanticTokenHandler.create({ index: index, cache: foam.parse.lsp.FileModelCache.create() });
      var scopeFile = "foam.CLASS({\n  package: 'test.integ',\n  name: 'ScopeModel',\n  requires: ['foam.lang.FObject'],\n  properties: [\n    { class: 'String', name: 'status' }\n  ],\n  methods: [\n    function test() {\n      var obj = this.FObject.create();\n      this.status = 'done';\n    }\n  ]\n})";
      var semResult = semanticHandler.handle(scopeFile, 'test://scope');
      x.test(semResult.data.length > 0, 'Integration: semantic tokens emitted for scope test');

      // CSS token resolver
      var resolver = foam.parse.lsp.CSSTokenResolver.create();
      resolver.loadFromRegistry();
      x.test(resolver.getAllTokenNames().length > 50, 'Integration: CSS resolver loaded tokens');
      x.test(resolver.tokenExists('primary400'), 'Integration: primary400 exists in resolver');

      // CSS completion
      var cssCompletion = foam.parse.lsp.handlers.CompletionHandler.create({ index: index, grammar: grammar, cssTokenResolver: resolver });
      var cssFile = "foam.CLASS({\n  package: 'test.integ',\n  name: 'CSSModel',\n  css: `\n    ^ { color: $\n  `\n})";
      var cssC = cssCompletion.handle(cssFile, { line: 4, character: 17 });
      x.test(cssC.items.length > 0, 'Integration: CSS completion returns token items');

      // CSS hover
      var cssHover = foam.parse.lsp.handlers.HoverHandler.create({ index: index, cache: foam.parse.lsp.FileModelCache.create(), cssTokenResolver: resolver });
      var cssHoverFile = "foam.CLASS({\n  package: 'test.integ',\n  name: 'CSSModel2',\n  css: `\n    ^ { color: $primary400; }\n  `\n})";
      var cssH = cssHover.handle(cssHoverFile, { line: 4, character: 18 });
      x.test(cssH != null, 'Integration: CSS hover returns content for $primary400');

      // CSS completion with textEdit — mid-word replacement
      var cssReplaceFile = "foam.CLASS({\n  package: 'test',\n  name: 'ReplaceTest',\n  css: `\n      display: flex;\n  `\n})";
      var cssR = cssCompletion.handle(cssReplaceFile, { line: 4, character: 9 });
      var hasTextEdit = cssR.items.length > 0 && cssR.items[0].textEdit != null;
      x.test(hasTextEdit, 'Integration: CSS completion items have textEdit for mid-word replace');
    }
  ]
});
