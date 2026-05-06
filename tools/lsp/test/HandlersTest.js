/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'HandlersTest',
  extends: 'foam.core.test.JSTest',

  methods: [
    async function runTest(x) {
      await this.testCompletionHandler(x);
      await this.testHoverHandler(x);
      await this.testDefinitionHandler(x);
      await this.testDiagnosticsHandler(x);
      await this.testSymbolHandler(x);
      await this.testMemberCompletionHandler(x);
      await this.testSemanticTokenHandler(x);
      await this.testCSSCompletionRefactored(x);
      await this.testCSSHover(x);
      await this.testCSSDiagnostics(x);
      await this.testBacktickBlockContext(x);
      await this.testCSSContext(x);
    },

    // ========== CompletionHandler ==========

    async function testCompletionHandler(x) {
      var handler = foam.parse.lsp.handlers.CompletionHandler.create();

      // Completing property class: '
      var result = handler.handle(
        "foam.CLASS({\n  properties: [\n    { class: '",
        { line: 2, character: 14 }
      );
      x.test(result.items.length > 0, 'Completion: should return property type completions');
      x.test(
        result.items.some(function(i) { return i.label === 'String'; }),
        'Completion: should suggest String'
      );
      x.test(
        result.items.some(function(i) { return i.label === 'Long'; }),
        'Completion: should suggest Long'
      );

      // Completing extends: '
      var result2 = handler.handle(
        "foam.CLASS({\n  extends: '",
        { line: 1, character: 13 }
      );
      x.test(result2.items.length > 0, 'Completion: should return class completions for extends');

      // No completions in plain JS
      var result3 = handler.handle(
        "var x = 42;\nfunction foo() {}",
        { line: 0, character: 5 }
      );
      x.test(result3.items.length === 0, 'Completion: should not suggest in plain JS');
    },

    // ========== HoverHandler ==========

    async function testHoverHandler(x) {
      var handler = foam.parse.lsp.handlers.HoverHandler.create();

      // Hover over a class name in extends
      var result = handler.handle(
        "foam.CLASS({\n  extends: 'foam.parse.Suggestion'\n})",
        { line: 1, character: 20 }
      );
      x.test(result != null, 'Hover: should return hover for class in extends');
      x.test(
        result.contents.value.indexOf('foam.parse.Suggestion') !== -1,
        'Hover: should contain class name'
      );

      // Hover over non-FOAM text
      var result2 = handler.handle(
        "var x = 42;",
        { line: 0, character: 5 }
      );
      x.test(result2 == null, 'Hover: should return null for non-FOAM file');
    },

    // ========== DefinitionHandler ==========

    async function testDefinitionHandler(x) {
      var handler = foam.parse.lsp.handlers.DefinitionHandler.create();

      // Go-to-definition on extends class
      var result = handler.handle(
        "foam.CLASS({\n  extends: 'foam.parse.Suggestion'\n})",
        { line: 1, character: 20 }
      );
      // Source location may be null depending on build environment
      x.test(
        result == null || (result.uri && result.uri.indexOf('parse') !== -1),
        'Definition: URI should point to parse directory or be null'
      );

      // No definition in plain JS
      var result3 = handler.handle(
        "var x = 42;",
        { line: 0, character: 5 }
      );
      x.test(result3 == null, 'Definition: should return null for non-FOAM file');

      // No definition for unknown class
      var result4 = handler.handle(
        "foam.CLASS({\n  extends: 'foo.bar.Nonexistent'\n})",
        { line: 1, character: 20 }
      );
      x.test(result4 == null, 'Definition: should return null for unknown class');
    },

    // ========== DiagnosticsHandler ==========

    async function testDiagnosticsHandler(x) {
      var handler = foam.parse.lsp.handlers.DiagnosticsHandler.create();

      // Valid class -- no errors
      var result = handler.handle(
        "foam.CLASS({\n  package: 'test',\n  name: 'Valid',\n  extends: 'foam.lang.FObject'\n})"
      );
      var errors = result.filter(function(d) { return d.severity === 1; });
      x.test(errors.length === 0, 'Diagnostics: valid class should have no errors');

      // Unknown extends class -- should flag error
      var result2 = handler.handle(
        "foam.CLASS({\n  package: 'test',\n  name: 'Bad',\n  extends: 'foo.bar.Nonexistent'\n})"
      );
      x.test(
        result2.some(function(d) { return d.message.indexOf('Nonexistent') !== -1 || d.message.indexOf('foo.bar') !== -1; }),
        'Diagnostics: should flag unknown class in extends'
      );

      // No diagnostics for non-FOAM file
      var result3 = handler.handle("var x = 42;");
      x.test(result3.length === 0, 'Diagnostics: non-FOAM file should have no diagnostics');
    },

    // ========== SymbolHandler ==========

    async function testSymbolHandler(x) {
      var handler = foam.parse.lsp.handlers.SymbolHandler.create();

      var text = "foam.CLASS({\n  package: 'test',\n  name: 'MyModel',\n  properties: [\n    { class: 'String', name: 'firstName' },\n    'lastName'\n  ],\n  methods: [\n    function greet() { return 'hello'; }\n  ]\n})";

      var result = handler.handle(text);
      x.test(result.length > 0, 'Symbol: should return document symbols');

      // Check for class symbol
      x.test(
        result.some(function(s) { return s.name === 'test.MyModel' && s.kind === 5; }),
        'Symbol: should have class symbol'
      );

      // Check for property symbols
      x.test(
        result.some(function(s) { return s.name === 'firstName'; }),
        'Symbol: should have firstName property symbol'
      );
      x.test(
        result.some(function(s) { return s.name === 'lastName'; }),
        'Symbol: should have lastName property symbol'
      );

      // Check for method symbols
      x.test(
        result.some(function(s) { return s.name === 'greet' && s.kind === 6; }),
        'Symbol: should have greet method symbol'
      );

      // Non-FOAM file
      var result2 = handler.handle("var x = 42;");
      x.test(result2.length === 0, 'Symbol: non-FOAM file should have no symbols');
    },

    // ========== MemberCompletionHandler ==========

    async function testMemberCompletionHandler(x) {
      // Register a test class
      foam.CLASS({
        package: 'foam.parse.lsp.test',
        name: 'MemberTestModel',
        properties: [
          { class: 'String', name: 'firstName' },
          { class: 'Int', name: 'age' }
        ],
        methods: [
          function greet() { return 'hello'; }
        ]
      });

      var handler = foam.parse.lsp.handlers.MemberCompletionHandler.create();

      // this. inside a method of the test class
      var text = "foam.CLASS({\n  package: 'foam.parse.lsp.test',\n  name: 'MemberTestModel',\n  methods: [\n    function doSomething() {\n      this.\n    }\n  ]\n})";
      var result = handler.handle(text, { line: 5, character: 11 });

      x.test(result.items.length > 0, 'Member: should return member completions');
      x.test(
        result.items.some(function(i) { return i.label === 'firstName'; }),
        'Member: should suggest firstName property'
      );
      x.test(
        result.items.some(function(i) { return i.label === 'age'; }),
        'Member: should suggest age property'
      );
      x.test(
        result.items.some(function(i) { return i.label === 'greet'; }),
        'Member: should suggest greet method'
      );

      // Non-FOAM file
      var result2 = handler.handle("var x = this.", { line: 0, character: 13 });
      x.test(result2.items.length === 0, 'Member: should not suggest in non-FOAM file');
    },

    // ========== SemanticTokenHandler ==========

    async function testSemanticTokenHandler(x) {
      var handler = foam.parse.lsp.handlers.SemanticTokenHandler.create({
        typeTracker: foam.parse.lsp.TypeTracker.create()
      });

      // Build a test FOAM class with requires, a property, and a method
      var text = [
        "foam.CLASS({",
        "  package: 'test.semantic',",
        "  name: 'TokenTest',",
        "  requires: [",
        "    'foam.core.notification.Notification',",       // line 4: 'notification' inside string
        "    'foam.u2.dialog.ToastState'",
        "  ],",
        "  properties: [",
        "    { class: 'String', name: 'notificationSub' }", // line 8
        "  ],",
        "  methods: [",
        "    function doStuff() {",                          // line 11
        "      var notification = this.Notification.create();", // line 12
        "      notification.userId = 1;",                   // line 13
        "      this.notificationSub = 'test';",             // line 14
        "    }",
        "  ]",
        "})"
      ].join('\n');

      var result = handler.handle(text, 'test://scope');
      var decoded = this.decodeSemanticTokens(result.data);

      // The word 'notification' (12 chars) on line 4 inside the requires string
      // should NOT have a semantic token — it's inside a structural range + string literal
      var line4Hits = decoded.filter(function(t) {
        return t.line === 4 && t.length === 12;
      });
      x.test(
        line4Hits.length === 0,
        'Semantic: "notification" inside requires string should NOT be highlighted'
      );

      // this.Notification on line 12 should be highlighted as type (token type 0)
      var thisNotifHits = decoded.filter(function(t) {
        return t.line === 12 && t.type === 0 && t.length === 12;
      });
      x.test(
        thisNotifHits.length > 0,
        'Semantic: this.Notification on line 12 should be highlighted as type (0)'
      );

      // this.notificationSub on line 14 should be highlighted as property (token type 2)
      var thisPropHits = decoded.filter(function(t) {
        return t.line === 14 && t.type === 2 && t.length === 15;
      });
      x.test(
        thisPropHits.length > 0,
        'Semantic: this.notificationSub on line 14 should be highlighted as property'
      );

      // notification usage on line 13 (inside code, not string) should be highlighted
      // as typed variable usage (type 2, modifiers 2 = readonly)
      var usageHits = decoded.filter(function(t) {
        return t.line === 13 && t.type === 2 && t.length === 12;
      });
      x.test(
        usageHits.length > 0,
        'Semantic: "notification" usage on line 13 should be highlighted as typed variable'
      );

      // --- CSS semantic tokens ---
      var cssResolver = foam.parse.lsp.CSSTokenResolver.create();
      cssResolver.loadFromRegistry();

      var cssHandler = foam.parse.lsp.handlers.SemanticTokenHandler.create({
        typeTracker: foam.parse.lsp.TypeTracker.create(),
        cssTokenResolver: cssResolver
      });

      var cssText = [
        "foam.CLASS({",
        "  package: 'test.css',",
        "  name: 'CSSTokenModel',",
        "  css: `",
        "    ^ { color: $primary400; }",
        "    ^toolbar { background: $backgroundDefault; }",
        "  `",
        "})"
      ].join('\n');

      var cssResult = cssHandler.handle(cssText, 'test://css-tokens');
      var cssDecoded = this.decodeSemanticTokens(cssResult.data);

      // $primary400 should get variable token (type 2)
      var primaryHits = cssDecoded.filter(function(t) {
        return t.type === 2 && t.length === '$primary400'.length;
      });
      x.test(
        primaryHits.length > 0,
        'Semantic CSS: $primary400 should be highlighted as variable (type 2)'
      );

      // ^toolbar should get type token (type 0)
      var toolbarHits = cssDecoded.filter(function(t) {
        return t.type === 0 && t.length === '^toolbar'.length;
      });
      x.test(
        toolbarHits.length > 0,
        'Semantic CSS: ^toolbar should be highlighted as type (type 0)'
      );

      // Test richer CSS highlighting: property names, values, comments, numbers
      var richCSSText = [
        "foam.CLASS({",
        "  package: 'test.css',",
        "  name: 'RichCSS',",
        "  css: `",
        "    /* Step section styling */",
        "    ^step-section {",
        "      display: flex;",
        "      gap: 1rem;",
        "      cursor: not-allowed;",
        "      color: $textSecondary;",
        "    }",
        "  `",
        "})"
      ].join('\n');

      var richResult = cssHandler.handle(richCSSText, 'test://rich-css');
      var richDecoded = this.decodeSemanticTokens(richResult.data);

      // Comment on line 4 should be highlighted (type 5)
      var commentHits = richDecoded.filter(function(t) { return t.line === 4 && t.type === 5; });
      x.test(commentHits.length > 0, 'Semantic CSS: comment should be highlighted (type 5)');

      // 'display' on line 6 should be keyword (type 3)
      var displayHits = richDecoded.filter(function(t) { return t.line === 6 && t.type === 3; });
      x.test(displayHits.length > 0, 'Semantic CSS: "display" property should be keyword (type 3)');

      // 'flex' on line 6 should be string/value (type 4)
      var flexHits = richDecoded.filter(function(t) { return t.line === 6 && t.type === 4; });
      x.test(flexHits.length > 0, 'Semantic CSS: "flex" value should be string (type 4)');

      // '1rem' on line 7 should be number (type 6)
      var remHits = richDecoded.filter(function(t) { return t.line === 7 && t.type === 6; });
      x.test(remHits.length > 0, 'Semantic CSS: "1rem" should be number (type 6)');

      // 'not-allowed' on line 8 should be string/value (type 4)
      var notAllowedHits = richDecoded.filter(function(t) { return t.line === 8 && t.type === 4; });
      x.test(notAllowedHits.length > 0, 'Semantic CSS: "not-allowed" value should be string (type 4)');

      // $textSecondary on line 9 should be variable (type 2)
      var textSecHits = richDecoded.filter(function(t) { return t.line === 9 && t.type === 2; });
      x.test(textSecHits.length > 0, 'Semantic CSS: $textSecondary should be variable (type 2)');
    },

    // ========== CSS Completion (Refactored) ==========

    async function testCSSCompletionRefactored(x) {
      var resolver = foam.parse.lsp.CSSTokenResolver.create();
      resolver.loadFromRegistry();
      var handler = foam.parse.lsp.handlers.CompletionHandler.create({ cssTokenResolver: resolver });

      function cssFile(cssBody) {
        return "foam.CLASS({\n  package: 'test',\n  name: 'C',\n  css: `\n" + cssBody + "\n  `\n})";
      }

      // Case 1: empty indented line → property names
      var r1 = handler.handle(cssFile('      '), { line: 4, character: 6 });
      x.test(r1.items.length > 50, 'CSSRefactor case 1: empty line → many property names');
      x.test(r1.items.some(function(i) { return i.label === 'display'; }), 'CSSRefactor case 1: includes display');
      x.test(r1.items[0].textEdit != null, 'CSSRefactor case 1: items have textEdit');

      // Case 2: partial property name "dis"
      var r2 = handler.handle(cssFile('      dis'), { line: 4, character: 9 });
      x.test(r2.items.some(function(i) { return i.label === 'display'; }), 'CSSRefactor case 2: "dis" → display');
      x.test( ! r2.items.some(function(i) { return i.label === 'cursor'; }), 'CSSRefactor case 2: "dis" excludes cursor');

      // Case 3: mid-word existing property "dis|play: flex;"
      var r3 = handler.handle(cssFile('      display: flex;'), { line: 4, character: 9 });
      x.test(r3.items.some(function(i) { return i.label === 'display'; }), 'CSSRefactor case 3: mid-word prop → display');
      var dispItem = r3.items.filter(function(i) { return i.label === 'display'; })[0];
      x.test(dispItem && dispItem.textEdit && dispItem.textEdit.range.end.character === 13,
        'CSSRefactor case 3: textEdit replaces full "display"');

      // Case 4: after semicolon "display: flex; "
      var r4 = handler.handle(cssFile('      display: flex; '), { line: 4, character: 21 });
      x.test(r4.items.length > 50, 'CSSRefactor case 4: after semi → property names');

      // Case 6: after colon "display: "
      var r6 = handler.handle(cssFile('      display: '), { line: 4, character: 15 });
      x.test(r6.items.some(function(i) { return i.label === 'flex'; }), 'CSSRefactor case 6: "display: " → flex');
      x.test(r6.items.some(function(i) { return i.label === 'none'; }), 'CSSRefactor case 6: "display: " → none');

      // Case 7: after colon no space "display:"
      var r7 = handler.handle(cssFile('      display:'), { line: 4, character: 14 });
      x.test(r7.items.some(function(i) { return i.label === 'flex'; }), 'CSSRefactor case 7: "display:" → flex');

      // Case 8: partial value "display: fl"
      var r8 = handler.handle(cssFile('      display: fl'), { line: 4, character: 17 });
      x.test(r8.items.some(function(i) { return i.label === 'flex'; }), 'CSSRefactor case 8: "fl" → flex');
      x.test( ! r8.items.some(function(i) { return i.label === 'none'; }), 'CSSRefactor case 8: "fl" excludes none');

      // Case 9: mid-word value "display: fl|ex;"
      var r9 = handler.handle(cssFile('      display: flex;'), { line: 4, character: 17 });
      x.test(r9.items.some(function(i) { return i.label === 'flex'; }), 'CSSRefactor case 9: mid-word val → flex');
      var flexItem = r9.items.filter(function(i) { return i.label === 'flex'; })[0];
      x.test(flexItem && flexItem.textEdit && flexItem.textEdit.range.end.character === 19,
        'CSSRefactor case 9: textEdit replaces full "flex"');

      // Case 10: $token in value position "color: $"
      var r10 = handler.handle(cssFile('      color: $'), { line: 4, character: 14 });
      x.test(r10.items.some(function(i) { return i.label === '$primary400'; }), 'CSSRefactor case 10: "$" → token items');

      // Case 11: partial $token "color: $prim"
      var r11 = handler.handle(cssFile('      color: $prim'), { line: 4, character: 18 });
      x.test(r11.items.some(function(i) { return i.label === '$primary400'; }), 'CSSRefactor case 11: "$prim" → primary400');
      x.test( ! r11.items.some(function(i) { return i.label === '$textDefault'; }), 'CSSRefactor case 11: "$prim" excludes textDefault');

      // Case 12: mid-word $token "color: $prim|ary400;"
      var r12 = handler.handle(cssFile('      color: $primary400;'), { line: 4, character: 18 });
      x.test(r12.items.some(function(i) { return i.label === '$primary400'; }), 'CSSRefactor case 12: mid-word $token → primary400');
      var tokItem = r12.items.filter(function(i) { return i.label === '$primary400'; })[0];
      x.test(tokItem && tokItem.textEdit && tokItem.textEdit.range.end.character === 24,
        'CSSRefactor case 12: textEdit replaces full "$primary400"');

      // Case 14: cursor property value suggestions
      var r14 = handler.handle(cssFile('      cursor: '), { line: 4, character: 15 });
      x.test(r14.items.some(function(i) { return i.label === 'not-allowed'; }), 'CSSRefactor case 14: cursor → not-allowed');
      x.test(r14.items.some(function(i) { return i.label === 'pointer'; }), 'CSSRefactor case 14: cursor → pointer');

      // NOT inside css block → no CSS items
      var noCSS = "foam.CLASS({\n  name: 'X',\n  properties: [\n    { class: 'String', name: 'foo' }\n  ]\n})";
      var rNo = handler.handle(noCSS, { line: 3, character: 20 });
      x.test( ! rNo.items.some(function(i) { return i.label === 'display'; }),
        'CSSRefactor: no CSS items outside css block');
    },

    // ========== CSSHover ==========

    async function testCSSHover(x) {
      var resolver = foam.parse.lsp.CSSTokenResolver.create();
      resolver.loadFromRegistry();

      var handler = foam.parse.lsp.handlers.HoverHandler.create({
        cssTokenResolver: resolver
      });

      var cssText = "foam.CLASS({\n  package: 'test',\n  name: 'CSSHov',\n  css: `\n    ^ { color: $primary400; }\n    ^toolbar { background: $backgroundDefault; }\n  `\n})";

      // Hover on $primary400 (line 4, character ~18 inside the token name)
      var result = handler.handle(cssText, { line: 4, character: 18 });
      x.test(result != null, 'CSSHover: should return hover for $primary400');
      x.test(
        result != null && result.contents.value.indexOf('primary400') !== -1,
        'CSSHover: hover content should contain primary400'
      );
      x.test(
        result != null && result.contents.value.indexOf('Default') !== -1,
        'CSSHover: hover content should contain Default theme info'
      );

      // Hover on $backgroundDefault (line 5, character ~32)
      var result2 = handler.handle(cssText, { line: 5, character: 32 });
      x.test(result2 != null, 'CSSHover: should return hover for $backgroundDefault');
    },

    // ========== CSSDiagnostics ==========

    async function testCSSDiagnostics(x) {
      var resolver = foam.parse.lsp.CSSTokenResolver.create();
      resolver.loadFromRegistry();

      var handler = foam.parse.lsp.handlers.DiagnosticsHandler.create({
        cssTokenResolver: resolver
      });

      // Valid $primary400 — should have no CSS token warnings
      var validText = "foam.CLASS({\n  package: 'test',\n  name: 'CSSDiagValid',\n  css: `\n    ^ { color: $primary400; }\n  `\n})";
      var result = handler.handle(validText);
      var cssWarnings = result.filter(function(d) {
        return d.message && d.message.indexOf('CSS token') !== -1;
      });
      x.test(cssWarnings.length === 0, 'CSSDiagnostics: valid $primary400 should have no CSS token warnings');

      // Unknown $nonExistentFakeToken — should produce a warning
      var invalidText = "foam.CLASS({\n  package: 'test',\n  name: 'CSSDiagBad',\n  css: `\n    ^ { color: $nonExistentFakeToken; }\n  `\n})";
      var result2 = handler.handle(invalidText);
      var cssWarnings2 = result2.filter(function(d) {
        return d.message && d.message.indexOf('nonExistentFakeToken') !== -1;
      });
      x.test(cssWarnings2.length > 0, 'CSSDiagnostics: unknown $nonExistentFakeToken should produce a warning');
    },

    // ========== BacktickBlockContext ==========

    async function testBacktickBlockContext(x) {
      var analyzer = foam.parse.lsp.CursorAnalyzer.create();

      // Inside css: block
      var cssText = [
        "foam.CLASS({",
        "  css: `",
        "    ^ { color: red; }",
        "  `",
        "})"
      ].join('\n');
      var ctx = analyzer.getBacktickBlockContext(cssText, { line: 2, character: 10 });
      x.test(ctx != null, 'BacktickCtx: should detect css block');
      x.test(ctx.blockKey === 'css', 'BacktickCtx: blockKey should be css');
      x.test(ctx.blockContent.indexOf('color') !== -1, 'BacktickCtx: blockContent should contain css text');

      // Inside javaCode: block
      var javaText = [
        "foam.CLASS({",
        "  properties: [{",
        "    name: 'x',",
        "    javaCode: `",
        "      return getX();",
        "    `",
        "  }]",
        "})"
      ].join('\n');
      var jCtx = analyzer.getBacktickBlockContext(javaText, { line: 4, character: 10 });
      x.test(jCtx != null, 'BacktickCtx: should detect javaCode block');
      x.test(jCtx.blockKey === 'javaCode', 'BacktickCtx: blockKey should be javaCode');

      // Inside javaPostSet: block
      var postSetText = [
        "foam.CLASS({",
        "  properties: [{",
        "    name: 'y',",
        "    javaPostSet: `",
        "      setZ(val);",
        "    `",
        "  }]",
        "})"
      ].join('\n');
      var pCtx = analyzer.getBacktickBlockContext(postSetText, { line: 4, character: 8 });
      x.test(pCtx != null && pCtx.blockKey === 'javaPostSet', 'BacktickCtx: should detect javaPostSet block');

      // Outside any backtick block
      var plainText = [
        "foam.CLASS({",
        "  name: 'Test',",
        "  properties: [",
        "    { class: 'String', name: 'foo' }",
        "  ]",
        "})"
      ].join('\n');
      var noCtx = analyzer.getBacktickBlockContext(plainText, { line: 3, character: 20 });
      x.test(noCtx == null, 'BacktickCtx: should return null outside backtick blocks');

      // Inside a regular backtick string (not a known block key like documentation)
      var unknownText = [
        "foam.CLASS({",
        "  documentation: `some docs`,",
        "  name: 'Test'",
        "})"
      ].join('\n');
      var uCtx = analyzer.getBacktickBlockContext(unknownText, { line: 1, character: 22 });
      x.test(uCtx == null, 'BacktickCtx: should return null for unknown block key like documentation');
    },

    // ========== CSSContext ==========

    async function testCSSContext(x) {
      var analyzer = foam.parse.lsp.CursorAnalyzer.create();

      // Case 1: empty line → propertyName
      var ctx1 = analyzer.getCSSContext('      ', 6);
      x.test(ctx1 != null && ctx1.type === 'propertyName', 'CSSCtx: empty line → propertyName');
      x.test(ctx1.partial === '', 'CSSCtx: empty line partial is empty');

      // Case 2: partial property name
      var ctx2 = analyzer.getCSSContext('      dis', 9);
      x.test(ctx2 != null && ctx2.type === 'propertyName', 'CSSCtx: partial prop → propertyName');
      x.test(ctx2.partial === 'dis', 'CSSCtx: partial is "dis"');
      x.test(ctx2.replaceRange.start === 6 && ctx2.replaceRange.end === 9, 'CSSCtx: replaceRange for "dis"');

      // Case 3: mid-word in existing property name (cursor at "dis|play: flex;")
      var ctx3 = analyzer.getCSSContext('      display: flex;', 9);
      x.test(ctx3 != null && ctx3.type === 'propertyName', 'CSSCtx: mid-word prop → propertyName');
      x.test(ctx3.partial === 'dis', 'CSSCtx: mid-word partial is "dis"');
      x.test(ctx3.replaceRange.end === 13, 'CSSCtx: replaceRange.end covers full "display"');

      // Case 4: after semicolon → propertyName
      var ctx4 = analyzer.getCSSContext('      display: flex; ', 21);
      x.test(ctx4 != null && ctx4.type === 'propertyName', 'CSSCtx: after semicolon → propertyName');

      // Case 5: after colon → propertyValue
      var ctx5 = analyzer.getCSSContext('      display: ', 15);
      x.test(ctx5 != null && ctx5.type === 'propertyValue', 'CSSCtx: after colon → propertyValue');
      x.test(ctx5.propName === 'display', 'CSSCtx: propName is "display"');
      x.test(ctx5.partial === '', 'CSSCtx: value partial is empty');

      // Case 6: after colon no space → propertyValue
      var ctx6 = analyzer.getCSSContext('      display:', 14);
      x.test(ctx6 != null && ctx6.type === 'propertyValue', 'CSSCtx: after colon no space → propertyValue');
      x.test(ctx6.propName === 'display', 'CSSCtx: propName after colon no space');

      // Case 7: partial value
      var ctx7 = analyzer.getCSSContext('      display: fl', 17);
      x.test(ctx7 != null && ctx7.type === 'propertyValue', 'CSSCtx: partial value → propertyValue');
      x.test(ctx7.partial === 'fl', 'CSSCtx: value partial is "fl"');

      // Case 8: mid-word in existing value ("fl|ex;")
      var ctx8 = analyzer.getCSSContext('      display: flex;', 17);
      x.test(ctx8 != null && ctx8.type === 'propertyValue', 'CSSCtx: mid-word value → propertyValue');
      x.test(ctx8.partial === 'fl', 'CSSCtx: mid-word value partial is "fl"');
      x.test(ctx8.replaceRange.end === 19, 'CSSCtx: replaceRange.end covers full "flex"');

      // Case 9: dollar token in value position
      var ctx9 = analyzer.getCSSContext('      color: $prim', 18);
      x.test(ctx9 != null && ctx9.type === 'propertyValue', 'CSSCtx: $token → propertyValue');
      x.test(ctx9.partial === '$prim', 'CSSCtx: $token partial includes $');

      // Case 10: mid-word dollar token ("$prim|ary400;")
      var ctx10 = analyzer.getCSSContext('      color: $primary400;', 18);
      x.test(ctx10 != null && ctx10.type === 'propertyValue', 'CSSCtx: mid-word $token → propertyValue');
      x.test(ctx10.partial === '$prim', 'CSSCtx: mid-word $token partial is "$prim"');
      x.test(ctx10.replaceRange.end === 24, 'CSSCtx: replaceRange covers "$primary400"');

      // Case 11: selector line (starts with ^)
      var ctx11 = analyzer.getCSSContext('    ^step-section {', 5);
      x.test(ctx11 != null && ctx11.type === 'selector', 'CSSCtx: ^ line → selector');

      // Case 12: inline after { on selector line
      var ctx12 = analyzer.getCSSContext('    ^ { ', 8);
      x.test(ctx12 != null && ctx12.type === 'propertyName', 'CSSCtx: after { inline → propertyName');

      // Case 13: multi-value — cursor on last value part
      var ctx13 = analyzer.getCSSContext('      border: 1px solid $', 25);
      x.test(ctx13 != null && ctx13.type === 'propertyValue', 'CSSCtx: multi-value → propertyValue');
      x.test(ctx13.partial === '$', 'CSSCtx: multi-value partial is "$"');
      x.test(ctx13.propName === 'border', 'CSSCtx: multi-value propName is "border"');
    },

    function decodeSemanticTokens(data) {
      /**
       * Decodes the LSP relative delta array back to absolute positions.
       * Returns array of { line, char, length, type, modifiers }.
       */
      var tokens = [];
      var prevLine = 0;
      var prevChar = 0;
      for ( var i = 0 ; i + 4 < data.length ; i += 5 ) {
        var deltaLine = data[i];
        var deltaChar = data[i + 1];
        var length    = data[i + 2];
        var type      = data[i + 3];
        var modifiers = data[i + 4];

        var line = prevLine + deltaLine;
        var ch   = deltaLine === 0 ? prevChar + deltaChar : deltaChar;

        tokens.push({ line: line, char: ch, length: length, type: type, modifiers: modifiers });
        prevLine = line;
        prevChar = ch;
      }
      return tokens;
    }
  ]
});
