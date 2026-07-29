/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.konvajs',
    name: 'ParserDemoView',
    extends: 'foam.u2.View',

    requires: [
        'org.konvajs.KonvaView',
        'foam.parse.Parsers',
        'foam.u2.layout.Cols',
        'foam.u2.layout.Rows',
        'foam.u2.tag.Button',
        'foam.u2.tag.TextArea',
        'foam.u2.borders.CardBorder'
    ],

    imports: ['window'],

    css: `
    ^ { height: 100%; display: flex; font-family: 'Inter', system-ui, sans-serif; background: #f5f7fa; }
    
    ^left-panel { 
      flex: 0 0 45%; 
      display: flex; 
      flex-direction: column;
      border-right: 1px solid #e1e4e8;
      background: #fafafa;
      z-index: 2;
      overflow-y: auto;
    }

    ^right-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fff;
      overflow: hidden;
    }

    ^header {
      padding: 16px 24px;
      border-bottom: 1px solid #f0f0f0;
      background: #fff;
      flex-shrink: 0;
    }
    ^header h2 { 
      margin: 0; 
      font-size: 16px; 
      font-weight: 600; 
      color: #1a1a1a; 
    }

    ^scroll-area { 
      padding: 24px; 
      display: flex; 
      flex-direction: column; 
      gap: 24px;
    }

    ^card-title {
      font-size: 12px;
      font-weight: 600;
      color: #24292e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #f0f0f0;
      padding-bottom: 8px;
    }

    ^input-area {
      padding: 24px;
      border-bottom: 1px solid #e1e4e8;
      background: #fff;
    }

    ^viz-area {
      flex: 1;
      background: #fff;
      display: flex;
      flex-direction: column;
      border-left: 1px solid #e1e4e8; /* Optional separation if needed */
    }

    /* Floating "Update" button footer in left panel */
    ^footer {
      position: sticky;
      bottom: 0;
      padding: 16px 24px;
      background: #fff;
      border-top: 1px solid #e1e4e8;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    ^label { 
      font-size: 11px; 
      font-weight: 600;
      color: #6a737d;
    }
    
    ^ .foam-u2-tag-TextArea {
      font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.5;
      padding: 12px;
      border: 1px solid #d1d5da;
      border-radius: 6px;
      background: #fafbfc;
      color: #24292e;
      resize: vertical;
    }
    ^ .foam-u2-tag-TextArea:focus {
      border-color: #0366d6;
      background: #fff;
      outline: none;
    }

    ^primary-btn {
      background: #2ea44f;
      color: white;
      border: 1px solid rgba(27, 31, 35, 0.15);
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      transition: background 0.2s;
    }
    ^primary-btn:hover { background: #2c974b; }

    ^error { 
      padding: 8px 12px; 
      background: #ffe3e6; 
      color: #cf222e; 
      border-radius: 6px; 
      border: 1px solid rgba(207, 34, 46, 0.2);
      font-size: 11px;
      font-family: monospace;
      margin-top: 8px;
    }
  `,


    properties: [
        {
            class: 'String',
            name: 'grammarCode',
            view: { class: 'foam.u2.tag.TextArea', rows: 15, cols: 50 },
            factory: function () {
                return `// Define your grammar methods here
// Must return a map of parsers
// implicit args: alt, sym, seq, seq1, str, repeat, etc...
{
  START: seq1(0, sym('expr'), eof()),

  // + - * / repeat rather than right-recurse, so they fold left:
  // 1-2-3 is (1-2)-3. '^' does right-recurse, which is correct for it.
  expr: seq(sym('expr1'), repeat(seq(alt('+', '-'), sym('expr1')))),

  expr1: seq(sym('expr2'), repeat(seq(alt('*', '/'), sym('expr2')))),

  expr2: seq(sym('expr3'), opt(seq1(1, '^', sym('expr2')))),

  expr3: alt(
    sym('group'),
    sym('number'),
    sym('variable')
  ),

  group: seq1(1, '(', sym('expr'), ')'),

  variable: str(plus(range('a', 'z'))),

  digit: range('0', '9'),

  number: str(plus(sym('digit')))
}`;
            }
        },
        {
            class: 'String',
            name: 'grammarActions',
            view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 50 },
            factory: function () {
                return `// Define semantic actions
// Method name must match symbol name + 'Action'
{
  // v[1] is a list of [op, operand] pairs - fold it left.
  exprAction: function(v) {
      return v[1].reduce(function(left, pair) {
          return { type: 'Binary', op: pair[0], left: left, right: pair[1] };
      }, v[0]);
  },
  expr1Action: function(v) {
      return v[1].reduce(function(left, pair) {
          return { type: 'Binary', op: pair[0], left: left, right: pair[1] };
      }, v[0]);
  },
  // '^' is right-associative: 2^3^2 is 2^(3^2).
  expr2Action: function(v) {
      if ( v[1] === null ) return v[0];
      return { type: 'Binary', op: '^', left: v[0], right: v[1] };
  },
  numberAction: function(v) {
      return { type: 'Literal', value: parseInt(v) };
  },
  variableAction: function(v) {
      return { type: 'Variable', name: v };
  }
}`;
            }
        },
        {
            class: 'String',
            name: 'inputText',
            factory: function () { return '(1 + 2) * 3'; }
        },
        {
            class: 'String',
            name: 'demoTitle',
            documentation: 'Heading for the left panel. Subclasses override it.',
            value: 'Parser Definition'
        },
        {
            class: 'Boolean',
            name: 'stripWhitespace',
            documentation: `Strips whitespace from the input before parsing, so
              the arithmetic grammar doesn't need whitespace rules. Grammars
              where whitespace is significant - anything matching a label or a
              quoted string - must turn this off and handle spacing in the
              grammar itself.`,
            value: true
        },
        {
            name: 'parser',
            postSet: function (_, p) {
                if (p) this.parse();
            }
        },
        {
            name: 'stage',
            class: 'Simple'
        },
        {
            name: 'layer',
            class: 'Simple'
        },
        {
            class: 'String',
            name: 'errorMessage'
        }
    ],

    methods: [
        function render() {
            this.SUPER();
            var self = this;
            this.addClass();

            this.start(this.Cols)

                // LEFT PANEL: Grammar & Actions
                .start().addClass(this.myClass('left-panel'))
                .start().addClass(this.myClass('header'))
                .start('h2').add(this.demoTitle$).end()
                .end()

                .start().addClass(this.myClass('scroll-area'))
                .start(this.CardBorder)
                .start('div').addClass(this.myClass('card-title')).add('Grammar (EBNF)').end()
                .tag(this.TextArea, { data$: this.grammarCode$, rows: 20 })
                .end()

                .start(this.CardBorder)
                .start('div').addClass(this.myClass('card-title')).add('Semantic Actions (JS)').end()
                .tag(this.TextArea, { data$: this.grammarActions$, rows: 12 })
                .end()
                .end()

                .start().addClass(this.myClass('footer'))
                .start(this.Button, { label: 'Compile & Update', buttonStyle: 'PRIMARY' })
                .addClass(this.myClass('primary-btn'))
                .on('click', () => self.compileAndRun())
                .end()
                .start('div').addClass(this.myClass('error'))
                .show(this.errorMessage$)
                .add(this.errorMessage$)
                .end()
                .end()
                .end()

                // RIGHT PANEL: Input & Viz
                .start().addClass(this.myClass('right-panel'))
                // Top: Input Area
                .start().addClass(this.myClass('input-area'))
                .start('div').style({ 'margin-bottom': '8px' })
                .start('span').addClass(this.myClass('card-title')).add('Test Input').end()
                .end()
                .tag(this.TextArea, { data$: this.inputText$, rows: 2 })
                .end()

                // Bottom: Viz
                .start().addClass(this.myClass('viz-area'))
                .start('div').style({ 'padding': '16px 24px 8px 24px', 'border-bottom': '1px solid #f0f0f0', 'background': '#fff' })
                .start('span').addClass(this.myClass('card-title')).add('Output: AST Visualization').end()
                .end()
                .start().style({ 'flex': '1', 'background': '#ffffff', 'position': 'relative', 'overflow': 'hidden' })
                .tag(self.KonvaView, {
                    width: 1200,
                    height: 800,
                    onStageReady: function (stage, layer) {
                        self.stage = stage;
                        self.layer = layer;
                        // Add a subtle grid background to the stage via CSS or just keep white
                        stage.container().style.background = '#ffffff';
                        self.compileAndRun();
                    }
                })
                .end()
                .end()
                .end()

                .end();
        },

        function compileAndRun() {
            this.errorMessage = '';

            try {
                var grammarBodyStr = this.grammarCode;
                var actionsBodyStr = this.grammarActions;

                var grammarFnBody = 'return (' + grammarBodyStr + ');';

                // Explicitly define independent parsers to avoid dependency issues or missing methods
                // This mimics the arguments traditionally available in FOAM grammars
                var parserFactoryMap = {
                    'seq': function () { return foam.parse.Sequence.create({ args: Array.from(arguments) }); },
                    'seq1': function (n) { return foam.parse.Sequence1.create({ n: n, args: Array.from(arguments).slice(1) }); },
                    'alt': function () { return foam.parse.Alternate.create({ args: Array.from(arguments) }); },
                    'sym': function (name) { return foam.parse.Parsers.create().sym(name); },
                    'literal': function (s, v) { return foam.parse.Literal.create({ s: s, value: v }); },
                    'literalIC': function (s, v) { return foam.parse.LiteralIC.create({ s: s, value: v }); },
                    'range': function (a, b) { return foam.parse.Range.create({ from: a, to: b }); },
                    'chars': function (s) { return foam.parse.Chars.create({ string: s }); },
                    'notChars': function (s) { return foam.parse.NotChars.create({ string: s }); },
                    'anyChar': function () { return foam.parse.AnyChar.create(); },
                    'not': function (p, opt_else) { return foam.parse.Not.create({ p: p, else: opt_else }); },
                    'optional': function (p) { return foam.parse.Optional.create({ p: p }); },
                    'opt': function (p) { return foam.parse.Optional.create({ p: p }); },
                    'repeat': function (p, delim, min, max) { return foam.parse.Parsers.create().repeat(p, delim, min, max); },
                    'plus': function (p, delim) { return foam.parse.Parsers.create().plus(p, delim); },
                    'eof': function () { return foam.parse.EOF.create(); },
                    'str': function (p) { return foam.parse.String.create({ p: p }); },
                    'nChars': function (n) { return foam.parse.Parsers.create().nChars(n); },
                    'seq0': function () { return foam.parse.Sequence0.create({ args: Array.from(arguments) }); }
                };

                var parserNames = Object.keys(parserFactoryMap);
                var parserFuncs = parserNames.map(k => parserFactoryMap[k]);

                var parserLibArgs = parserNames.concat([grammarFnBody]);

                // Create the function: function(alt, seq, ...) { return (userCode); }
                var grammarFunc = new Function(...parserLibArgs);

                var actionsMap = new Function('return (' + actionsBodyStr + ')')();

                // Build a Grammar instance directly rather than declaring a
                // class per compile. foam.CLASS registers permanently, so the
                // old approach leaked a class into the global registry on
                // every click of Compile.
                var grammar = foam.parse.Grammar.create(null, this);
                var symbols = grammarFunc.apply(this, parserFuncs);

                for (var name in symbols) {
                    grammar.addSymbol(name, symbols[name]);
                }

                // Grammar matches actions to symbols by stripping the
                // 'Action' suffix, the same convention foam.parse.Grammar's
                // init() uses for declared methods.
                for (var key in actionsMap) {
                    var symbolName = key.replace(/Action$/, '');
                    grammar.addAction(symbolName, actionsMap[key].bind(this));
                }

                this.parser = grammar;
                this.parse();

            } catch (e) {
                console.error(e);
                this.errorMessage = 'Compilation Error: ' + e.message;
            }
        },

        function parse() {
            if (!this.parser || !this.stage) return;

            this.layer.destroyChildren();

            var text = this.stripWhitespace ?
                this.inputText.replace(/\s+/g, '') :
                this.inputText;
            if (!text) {
                this.layer.draw();
                return;
            }

            var result;
            try {
                result = this.parser.parseString(text);
            } catch (e) {
                this.errorMessage = 'Runtime Parse Error: ' + e.message;
                this.layer.draw();
                return;
            }

            console.log('Parsed Result:', result);

            if (result) {
                this.drawResult(result, 500, 50);
            } else {
                this.errorMessage = 'Parse Failed (returned null/undefined). Check grammar or input.';
            }
            this.layer.draw();
        },

        function drawResult(data, x, y) {
            // Generic Visualization
            if (typeof data === 'object' && data !== null) {
                this.drawGenericNode(data, x, y, 200);
            } else {
                // Primitive value
                var text = new Konva.Text({
                    x: x, y: y,
                    text: 'Result: ' + data,
                    fontSize: 20,
                    fill: '#24292e',
                    fontFamily: 'Inter'
                });
                this.layer.add(text);
            }
        },

        function drawGenericNode(node, x, y, offset) {
            var self = this;

            // 1. Identify Label & Type for Coloring
            var label = 'Node';
            var type = 'Generic';

            // Determine the type for coloring
            if (node.op) { type = 'Operator'; }
            else if (node.type) { type = node.type; }
            else if (node.name) { type = 'Identifier'; }
            else if (Array.isArray(node)) { type = 'Array'; }

            // Build the label from ALL primitive values in the node
            var labelParts = [];

            // Add type first if it exists
            if (node.type) {
                labelParts.push(node.type);
            } else if (node.op) {
                labelParts.push(node.op);
            } else if (Array.isArray(node)) {
                labelParts.push('Array[' + node.length + ']');
            }

            // Add all other primitive values (strings, numbers, booleans)
            for (var key in node) {
                if (node.hasOwnProperty(key) &&
                    key !== 'type' &&
                    key !== 'cls_' &&
                    (typeof node[key] === 'string' ||
                        typeof node[key] === 'number' ||
                        typeof node[key] === 'boolean')) {
                    var val = node[key].toString();
                    if (val.length > 0) {
                        labelParts.push(val);
                    }
                }
            }

            // Combine parts with newlines for multi-line labels
            label = labelParts.join('\n');

            // Fallback if no parts found
            if (labelParts.length === 0) {
                label = 'Node';
            }

            // Don't truncate - let Konva handle text wrapping
            // if (label.toString().length > 12) label = label.toString().substring(0, 9) + '...';

            // 2. Color Palette (Soft, professional colors)
            var colors = {
                'Operator': { fill: '#f8f9fa', stroke: '#d1d5da', text: '#24292e' }, // Gray
                'Literal': { fill: '#e6fffa', stroke: '#38d9a9', text: '#234e52' }, // Teal
                'Variable': { fill: '#fff5f5', stroke: '#fc8181', text: '#c53030' }, // Red/Pink
                'Identifier': { fill: '#fff5f5', stroke: '#fc8181', text: '#c53030' },
                'Binary': { fill: '#ebf8ff', stroke: '#63b3ed', text: '#2c5282' }, // Blue
                'Array': { fill: '#faf5ff', stroke: '#b794f4', text: '#553c9a' }, // Purple
                'LabelledEmail': { fill: '#fff5e6', stroke: '#ffa94d', text: '#d9480f' }, // Orange
                'SimpleEmail': { fill: '#e6fffa', stroke: '#38d9a9', text: '#234e52' }, // Teal
                'Generic': { fill: '#ffffff', stroke: '#e1e4e8', text: '#24292e' }
            };
            var style = colors[type] || colors['Generic'];

            // 3. Create Group (for easier dragging/events)
            var group = new Konva.Group({
                x: x, y: y,
                draggable: true // Enable node dragging
            });

            // Shadow for depth
            var circle = new Konva.Circle({
                radius: 50, // Increased from 35 to accommodate multi-line text
                fill: style.fill,
                stroke: style.stroke,
                strokeWidth: 2,
                shadowColor: '#000',
                shadowBlur: 10,
                shadowOpacity: 0.05,
                shadowOffset: { x: 0, y: 4 }
            });

            var text = new Konva.Text({
                text: label.toString(),
                fontSize: 11, // Slightly smaller for multi-line
                fontFamily: 'Inter',
                fontStyle: '600',
                fill: style.text,
                align: 'center',
                verticalAlign: 'middle',
                width: 90, // Set width for wrapping
                padding: 5
            });
            // Center text
            text.offsetX(text.width() / 2);
            text.offsetY(text.height() / 2);

            // Hover effects
            group.on('mouseenter', function () {
                document.body.style.cursor = 'pointer';
                circle.strokeWidth(3);
                circle.shadowOpacity(0.15);
                self.layer.batchDraw();
            });
            group.on('mouseleave', function () {
                document.body.style.cursor = 'default';
                circle.strokeWidth(2);
                circle.shadowOpacity(0.05);
                self.layer.batchDraw();
            });

            group.add(circle);
            group.add(text);

            // Add tooltips later if needed, for now hover expands stroke

            // 4. Identify Children
            var children = [];
            if (Array.isArray(node)) {
                children = node.filter(c => typeof c === 'object' && c !== null);
            } else {
                // Check ALL properties for nested objects, not just specific keys
                for (var key in node) {
                    if (node.hasOwnProperty(key) &&
                        typeof node[key] === 'object' &&
                        node[key] !== null &&
                        key !== 'cls_') { // Skip FOAM internal properties
                        children.push(node[key]);
                    }
                }
            }

            // RECURSE DRAW LINES BEFORE GROUP (so lines are behind nodes)
            if (children.length > 0) {
                children.forEach((child, i) => {
                    var childX = x - offset / 2 + (offset * i / (Math.max(1, children.length - 1)));
                    if (children.length === 1) childX = x;

                    var childY = y + 100; // More vertical spacing

                    // Cubic Bezier for smooth connections
                    var path = new Konva.Path({
                        data: `M ${x} ${y + 50} C ${x} ${y + 85}, ${childX} ${childY - 85}, ${childX} ${childY - 50}`,
                        stroke: '#cbd5e0',
                        strokeWidth: 2,
                        lineCap: 'round',
                        lineJoin: 'round'
                    });
                    self.layer.add(path);
                    path.zIndex(0); // Send to back

                    self.drawGenericNode(child, childX, childY, offset / 1.6);
                });
            }

            // Add group last so it's on top of lines
            this.layer.add(group);
        }
    ]
});
