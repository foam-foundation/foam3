/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.parse',
  name: 'CSSParser',

  documentation:`
    A CSS parser. Currently only used for autocompleting GUI based CSS inputs but can be used as a real parser when loading css into FOAM.

    NOTE: Requires CORE to function since tokens are pulled from cssTokenOverrideService
  `,


  requires: [
    'foam.parse.Grammar',
    'foam.parse.LiteralIC',
    'foam.parse.Suggest',
    'foam.parse.Parsers',
    'foam.parse.StringPStream'
  ],

  axioms: [
    foam.pattern.Singleton.create()
  ],

  properties: [
    {
      name: 'baseGrammar_',
      value: function(alt, anyChar, literal, not, opt, range, repeat, repeat0, seq, seq1, str, sug, sym) {
        // Override sug to add prepend overrides
        let oldSug = sug;
        sug = (v, opt) => { return oldSug(v, { prependSpaceOnSelect: false, ...opt}) };
        // Add a literal sug
        let sugl = v => sug(v, { text: v});

        return {
          START: sym('css'),
          ws: repeat0(' '),
          css: repeat(
            alt(
              sym('mediaQuery'),
              sym('block')
            )
          ),
          block: seq(
            sym('selector'),
            opt(sym('ws')),
            '{',
            opt(sym('ws')),
            repeat(
              sym('property')
            ),
            opt(sym('ws')),
            '}'
          ),
          mediaQuery: seq(
            '@media',
            opt(sym('ws')),
            sym('mediaCondition'),
            opt(sym('ws')),
            '{',
            repeat(
              sym('block')
            ),
            '}'
          ),
          mediaCondition: repeat(not('{', anyChar()), null, 1),
          selector: repeat(not('{', sym('selectorName')), null, 1),
          selectorName: repeat(not(',', seq(opt('^'), str(repeat(anyChar())))), null, 1),
          property: seq(
            sym('propertyName'),
            opt(sym('ws')),
            ':',
            opt(sym('ws')),
            sym('propertyValue'),
            opt(sym('ws')),
            opt('!important'),
            opt(sym('ws')),
            ';'
          ),
          propertyName: str(repeat(not(':', anyChar()), null, 1)),
          propertyValue: repeat(not(alt('!important', ';'), anyChar()), null, 1),
          genericPropertyValue: repeat(not(alt(' ', ';', '\n', '\r', ','), anyChar()), null, 1),
          typedPropertyValue: alt(
            sym('tokenValue'),
            sym('paddingValue'),
            sym('marginValue'),
            sym('borderValue'),
            sym('colorPropertyValue'),
            sym('genericPropertyValue')
          ),
          // Token suggestions
          tokenValue: sym('tokens'),
          // CSS property value suggestions
          tokenIdentifier: repeat(not(alt(' ', ';', '\n', '\r', ','), anyChar())),
          // Padding suggestions
          paddingValue: seq(
            repeat(
              sym('sizeValue')
            )
          ),
          sizeValue: sug(seq(
            sym('number'),
            opt(sym('sizeUnit'))
          ), { tooltip: 'Size value with optional unit' }),
          number: repeat(
            range('0', '9'), null, 1
          ),
          sizeUnit: alt(
            sugl('px'),
            sugl('em'),
            sugl('rem'),
            sugl('%'),
            sugl('vh'),
            sugl('vw'),
            sugl('vmin'),
            sugl('vmin'),
            sugl('in'),
            sugl('pt'),
            sugl('ch')
          ),
          // Margin suggestions
          marginValue: seq(
            repeat(
              sym('sizeValue')
            )
          ),
          // Border suggestions
          borderValue: seq(
            sym('borderWidth'),
            ' ',
            sym('borderStyle'),
            ' ',
            sym('colorPropertyValue')
          ),
          borderWidth: alt(
            sym('sizeValue'),
            sugl('thin'),
            sugl('medium'),
            sugl('thick')
          ),
          borderStyle: alt(
            sugl('none'),
            sugl('hidden'),
            sugl('dotted'),
            sugl('dashed'),
            sugl('solid'),
            sugl('double'),
            sugl('groove'),
            sugl('ridge'),
            sugl('inset'),
            sugl('outset')
          ),
          // Color value suggestions
          hexValue: str(seq(
            '#', repeat(
              sym('hexDigit'), null, 3, 6
            )
          )),
          hexDigit: alt(
            range('0', '9'),
            range('a', 'f'),
            range('A', 'F')
          ),
          rbgValue: seq(
            alt('rgb', 'rgba'),
            '(',
            sym('rgbNumber'), ',', sym('rgbNumber'), ',', sym('rgbNumber'),
            opt(seq(',', sym('alphaValue'))),
            ')'
          ),
          rgbNumber: range('0', '255'),
          alphaValue: seq(
            '0.', repeat(
              range('0', '9'), null, 1
            )
          ),
          hslValue: seq(
            alt('hsl', 'hsla'),
            '(',
            sym('hue'), ',', sym('percentage'), ',', sym('percentage'),
            opt(seq(',', sym('alphaValue'))),
            ')'
          ),
          hue: range('0', '360'),
          percentage: seq(
            range('0', '100'),
            '%'
          ),
          colorPropertyValue: alt(
            str(seq(sug(literal('$'), { text: '$', label: 'CSS Token', prependSpaceOnSelect: false }), sym('tokenValue'))),
            sug(sym('hexValue'), { view: 'foam.parse.auto.ColorSuggester', label: 'Hex Color' }),
            // Only one is required
            // sug(sym('rbgValue'), { view: 'foam.parse.auto.ColorSuggester', text: 'RGB Color' }),
            // sug(sym('hslValue'), { view: 'foam.parse.auto.ColorSuggester', text: 'HSL Color' }),
            sug('transparent', { text: 'transparent' })
          )
        };
      }
    },
    {
      name: 'tokensGrammar_',
      value: function(action, alt, nyChar, eof, join, literal, literalIC, not, notChars, optional, range,
        repeat, repeat0, seq, seq1, str, sug, sym, until) {
          // Only loading base, maybe add tokens from all classes
          let tokenProps = [];
          let allTokens  = foam.u2.CSSTokens.getAxiomsByClass(foam.u2.CSSToken);
          let token      = (token) => sug(literal(token.name, token), { text: token.name, view: { class: 'foam.parse.auto.CSSTokenSuggester', token: token }, prependSpaceOnSelect: false });

          allTokens.sort((o1, o2) => {
            o1 = o1.name;
            o2 = o2.name;
            return (o2.length - o1.length) || foam.util.compare(o1, o2);
          });

          allTokens.forEach(v => {
            tokenProps.push(token(v));
          });

          return alt.apply(null, tokenProps);
          // Load current theme tokens if they exist
          // Can this work?? Do we need this??
          // if ( this.cssTokenOverrideService ) {
          //   let map = this.cssTokenOverrideService.tokenCache[this.importedTheme.id];
          //   if ( ! map ) return;
          //   let themeTokens = Object.keys(map).map(v => {
          //     return foam.u2.CSSToken.create({ name: v, value: map[v] });
          //   })
          // }
      }
    },
    {
      name: 'grammar_',
      factory: function() {
        let base       = foam.Function.withArgs(this.baseGrammar_,   this.Parsers.create(), this);
        let tokens     = foam.Function.withArgs(this.tokensGrammar_, this.Parsers.create(), this);
        let grammar    = {
          __proto__: base,
          tokens: tokens
        };
        let self       = this;
        let g = this.Grammar.create({
          symbols: grammar
        });

        // let actions    = {
        //   'colorPropertyValue': function (a) {
        //   }
        // };
        // g.addActions(actions);
        return g;
      }
    }
  ],

  methods: [
    function parseString(str, opt_name, opt_apply) {
      let query = this.grammar_.parseString(str, opt_name, opt_apply);
      // if we can simplify the query, do so now (something AND FALSE -> FALSE)
      query = query && query.partialEval ? query.partialEval() : query;
      return query;
    }
  ]
});
