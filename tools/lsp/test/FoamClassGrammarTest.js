/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.test',
  name: 'FoamClassGrammarTest',
  extends: 'foam.core.test.JSTest',

  methods: [
    async function runTest(x) {
      var index = foam.parse.lsp.FoamIndex.create();
      var grammar = foam.parse.lsp.FoamClassGrammar.create({ index: index });

      await this.testPropertyTypeSuggestions(x, grammar);
      await this.testClassRefSuggestions(x, grammar);
      await this.testTopLevelKeySuggestions(x, grammar);
      await this.testParseValidClass(x, grammar);
      await this.testParseError(x, grammar);
    },

    async function collectSuggestions(grammar, input, cursorOffset) {
      /** Parse input and collect suggestions at cursorOffset. */
      var suggestions = {};
      var maxPos = 0;

      var apply = function(p, g) {
        if ( this.pos > maxPos ) {
          suggestions = {};
          maxPos = this.pos;
        }
        if ( this.pos === cursorOffset && p.suggest ) {
          var s = p.suggest();
          if ( s ) suggestions[s.text || s.label] = s;
        }
        // Also collect suggestions at maxPos (end of successful parse)
        if ( this.pos === maxPos && p.suggest ) {
          var s = p.suggest();
          if ( s ) suggestions[s.text || s.label] = s;
        }
        return p.parse(this, g);
      };

      var str = input + String.fromCharCode(26); // EOF
      var ps = foam.parse.StringPStream.create({ str: str, apply: apply });
      grammar.parse(ps);

      return { suggestions: suggestions, maxPos: maxPos };
    },

    async function testPropertyTypeSuggestions(x, grammar) {
      // Cursor inside class: '' in a property definition
      var input = "foam.CLASS({\n  properties: [\n    { class: '";
      var result = await this.collectSuggestions(grammar, input, input.length);

      x.test(
        result.suggestions['String'] != null,
        'Should suggest String property type'
      );
      x.test(
        result.suggestions['Long'] != null,
        'Should suggest Long property type'
      );
      x.test(
        result.suggestions['Boolean'] != null,
        'Should suggest Boolean property type'
      );
    },

    async function testClassRefSuggestions(x, grammar) {
      var input = "foam.CLASS({\n  extends: '";
      var result = await this.collectSuggestions(grammar, input, input.length);

      var keys = Object.keys(result.suggestions);
      x.test(keys.length > 0, 'Should suggest classes for extends');
      x.test(
        keys.some(function(k) { return k.indexOf('FObject') !== -1; }),
        'Should suggest FObject'
      );
    },

    async function testTopLevelKeySuggestions(x, grammar) {
      var input = "foam.CLASS({\n  ";
      var result = await this.collectSuggestions(grammar, input, input.length);

      var keys = Object.keys(result.suggestions);
      x.test(keys.length > 0, 'Should suggest top-level keys');
    },

    async function testParseValidClass(x, grammar) {
      var input = "foam.CLASS({\n  package: 'test.lsp',\n  name: 'ValidModel'\n})";
      var str = input + String.fromCharCode(26);
      var ps = foam.parse.StringPStream.create({ str: str });
      var result = grammar.parse(ps);

      x.test(result != null, 'Should parse a valid foam.CLASS definition');
    },

    async function testParseError(x, grammar) {
      var input = "foam.CLASS({\n  package: 'test',\n  name: ";
      var maxPos = 0;
      var apply = function(p, g) {
        maxPos = Math.max(maxPos, this.pos);
        return p.parse(this, g);
      };
      var str = input + String.fromCharCode(26);
      var ps = foam.parse.StringPStream.create({ str: str, apply: apply });
      grammar.parse(ps);

      x.test(maxPos > 0, 'Should track parse progress before error');
      x.test(maxPos >= input.indexOf('name:'), 'Error position should be at or after name:');
    }
  ]
});
