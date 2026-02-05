/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.demos.basic',
  name: 'Compiler',
  extends: 'foam.parse.Grammar',

  properties: [
    'currentLine',
    { class: 'Int', name: 'nextLabel_' },
    { name: 'vars', factory: function() { return { '_d': true }; } },
    { name: 'defs', factory: function() { return []; } },
    { name: 'data', factory: function() { return []; } },
    { name: 'fors', factory: function() { return {}; } },
    {
      name: 'symbols',
      factory: function() {
        return function(alt, sym, seq1, seq, literalIC, repeat, str, optional, plus, range, anyChar, notChars, literal, until, not) {
          return {
            START: repeat(sym('line'), seq(sym('ws'), '\n')),
            line: seq(sym('lineNumber'), sym('ws'), sym('statements')),
            ws: repeat(' '),
            lineNumber: sym('number'),
            statements: repeat(sym('statement'), seq(sym('ws'), ':', sym('ws'))),
            statement: alt(
              sym('data'),
              sym('def'),
              sym('dim'),
              sym('end'),
              sym('for'),
              sym('gosub'),
              sym('goto'),
              sym('if'),
              sym('input'),
              sym('next'),
              sym('on'),
              sym('print'),
              sym('read'),
              sym('restore'),
              sym('rem'),
              sym('return'),
              sym('sound'),
              sym('let'),
              sym('javascript'),
              sym('syntaxerror')),
            data: seq1(1, 'DATA ', repeat(alt(sym('number'), sym('string')), seq(sym('ws'), ',', sym('ws')))),
            def: seq('DEF ', sym('symbol'), '(', str(repeat(notChars(')'))), ')=', str(repeat(notChars('\n')))),
            dim: seq1(1, 'DIM ', repeat(sym('dimElement'), ',')),
            dimElement: seq(sym('symbol'), '(', repeat(sym('expr'),','), ')'),
            end: alt(literal('END', 'return;'), literal('STOP', 'return;')),
            for: seq('FOR', sym('ws'), sym('symbol'), sym('ws'), '=', sym('ws'), sym('expr'), sym('ws'), 'TO', sym('ws'), sym('expr'), optional(seq1(3, sym('ws'), 'STEP', sym('ws'), sym('expr')), 1)),
            gosub: seq1(2, 'GOSUB',  sym('ws'), sym('number')),
            goto: seq1(2, 'GOTO', sym('ws'), sym('gotoLine')),
            gotoLine: sym('number'),
            if: seq('IF', sym('ws'), seq1(0, sym('predicate'), sym('ws'), 'THEN', sym('ws')), alt(sym('gotoLine'), str(sym('statements')))),
            input: seq('INPUT', sym('ws'), optional(seq1(0, sym('string'), ';', sym('ws'))), repeat(sym('lhs'), ',')),
            let: seq(optional('LET '), sym('lhs'), sym('ws'), '=', sym('ws'), sym('expr')),
            lhs: alt(sym('fn'), sym('symbol')),
            next: seq1(2, 'NEXT', sym('ws'), sym('symbol')),
            on: seq('ON', sym('ws'), sym('expr'), sym('ws'), 'GOTO', str(repeat(notChars('\n')))),
            print: seq('PRINT', sym('ws'), optional(sym('printArgs')), optional(seq1(1, sym('ws'), alt(';',','), sym('ws')))),
            printArgs: seq(sym('expr'), optional(seq(seq1(1,sym('ws'), alt(';',',',''), sym('ws')), sym('printArgs')))),
            read: seq1(2, 'READ', sym('ws'), repeat(sym('lhs'), ',')),
            rem: seq1(1, 'REM', str(repeat(notChars('\n')))),
            sound: seq('SOUND', sym('ws'), sym('expr'), sym('ws'), ',', sym('ws'), sym('expr')),
            restore: literal('RESTORE', '_d = 0;'),
            return: literal('RETURN'),
            string: seq1(1, '"', repeat(notChars('"')), '"'),
            expr: seq(sym('expr1'), optional(seq(alt('+', '-'), sym('expr')))),
            expr1: seq(sym('expr2'), optional(seq(alt('*', '/'), sym('expr1')))),
            expr2: seq(sym('expr3'), optional(seq('^', sym('expr2')))),
            expr3: alt(
              str(seq('(', sym('expr'), ')')),
              seq1(1, '(', sym('predexpr'), ')'),
              str(seq('-', sym('expr3'))),
              sym('number'),
              sym('string'),
              sym('fn'),
              sym('symbol')
            ),
            predexpr: sym('predicate'),
            predicate: str(seq(
              str(alt(
                seq(sym('expr'), sym('ws'), alt(literal('=', '==='), literal('<>', '!='),'<=','>=','<','>'), sym('ws'), sym('expr')),
                seq('(', sym('ws'), sym('predicate'), sym('ws'), ')'),
                seq(literal('NOT', '!'), sym('ws'), sym('predicate')))),
              optional(str(seq(
                sym('ws'),
                alt(literal('AND','&&'), literal('OR', '||')),
                sym('ws'),
                sym('predicate'))
              )))),
            fn: seq(sym('symbol'), '(', repeat(sym('expr'), seq(sym('ws'), ',', sym('ws'))), ')'),
            javascript: seq1(1, 'JAVASCRIPT ', str(repeat(notChars(':\n')))),
            syntaxerror: str(repeat(notChars(':\n'))),
            number: str(seq(
              optional('-'),
              str(alt(
                seq(str(repeat(sym('digit'))), '.', str(plus(sym('digit')))),
                plus(sym('digit')))))),
            digit: range('0', '9'),
            symbol: str(seq(
              alt(range('a', 'z'), range('A', 'Z')),
              str(repeat(alt(range('a', 'z'), range('A', 'Z'), range('0', '9')))),
              optional('$')
            ))
          };
        }
      }
    }
  ],

  methods: [
    function init() {
      var self = this;
      this.addActions({
        START: function(lines) { return self.jsGenerator(lines).replace(/\n      /g,'\n').substring(1); },
        lineNumber: function(a) { self.currentLine = a; return a; },
        input: function(a) {
          a[3].forEach(v => self.addVar(v));
          return `PRINT(${(a[2] ? a[2].substring(0, a[2].length-1) : '"') + '? "'}); ` + a[3].map((v,i) => `${v} = await INPUT${ v.indexOf('$') != -1 ? '$' : ''}();`).join(' ');
        },
        on: function(a) { return `{ var l = [${a[5]}][${a[2]}-1]; if ( l ) { _line = l; break; } }`; },
        def: function(a) {
          self.defs.push(`function ${a[1]}(${a[3]}) { return ${a[5]}; }`);
          return '';
        },
        data: function(a) { a.forEach(d => self.data.push(d)); return ''; },
        dim: function(a) {
          return a.map(e => {
            self.addVar(e[0] + '_A');
            return `${e[0]}_A = DIM(${e[0].endsWith('$') ? '""' : 0},${e[2].join()});`;
          }).join('');
        },
        expr: function(a) { return a[1] ? a[0] + a[1].join('') : a[0]; },
        expr1: function(a) { return a[1] ? a[0] + a[1].join('') : a[0]; },
        expr2: function(a) { return a[1] ? `Math.pow(${a[0]}, ${a[1][1]})` : a[0]; },
        predexpr: function(p) { return `((${p}) ? -1 : 0)`; },
        rem: function(a) { return '// REM' + a; },
        fn: function(a) {
          // array lookup
          if ( self.vars[a[0] + '_A'] ) return `${a[0]}_A[${a[2].join('][')}]`;
          // function call
          return `${a[0]}(${a[2].join()})`;
        },
        for: function(a) {
          self.addVar(a[2]);
          var name = a[2] + self.currentLine + '_';
          self.fors[a[2]] = name;
          return `${a[2]} = ${a[6]}; ${name}END = ${a[10]}; ${name}INCR = ${a[11]}; case '${name}FOR': if ( ! RANGE(${a[2]}, ${name}END, ${name}INCR) ) { _line = '${name}END'; break; }`;
        },
        next: function(a) {
          var name = self.fors[a];
          return `${a} += ${name}INCR; _line = '${name}FOR'; break; case '${name}END':`;
        },
        let: function(a) { return `${a[1]} = ${a[5]};`; },
        sound: function(a) { return `await SOUND(${a[2]},${a[6]});`; },
        lhs: function(v) { self.addVar(v); return v; },
        if: function(a) { var l = self.nextLabel(); return `if ( ! ( ${a[2]} ) ) { _line = ${l}; break; } ${a[3]} case ${l}:`; },
        string: function(a) { return `"${a.map(c => (c == '\\') ? '\\\\' : c).join('')}"`; },
        print: function(a) {
          var ret = '';
          function tail(p) {
            if ( ! p ) return;
            var h = p[0], t = p[1];
            ret += h.startsWith('TAB') ? h + ';' : `PRINT(${h});`;
            if ( t ) {
              if ( t[0] === ',' ) ret += 'TAB();';
              tail(t[1]);
            }
          }
          tail(a[2]);
          if ( ! a[3] ) ret += 'NL();'; else if ( a[3] === ',' ) ret += 'TAB();';
          return ret;
        },
        gotoLine: function(l) { return `_line = ${l}; break;`; },
        gosub: function(l) { var ret = self.nextLabel(); return `_line = ${l}; _stack.push(${ret}); break; case ${ret}: `; },
        read: function(a) {
          return a.map(s => {
            self.addVar(s);
            return `${s} = _data[_d++];`;
          }).join('');
        },
        return: function() { return '_line = _stack.pop(); break;' },
        xxxsyntaxerror: function(a) {
          return ' SYNTAX ERROR: ' + a;
        }
      });
    },
    function addVar(v) { if ( v.indexOf('[') == -1 ) this.vars[v] = true; },
    function nextLabel() { return `'L${this.nextLabel_++}'`; }
  ],

  templates: [
    {
      name: 'jsGenerator',
      args: [ 'lines' ],
      template: `
      // Compiled from BASIC to JS
      async function main() {
        const _stack = [];
        const _data = [<%= this.data.join(',') %>];
        <%= this.defs.join(';\\n  ') %>
        var <%= Object.keys(this.vars).map(v => v + '=' + ( v.endsWith('$') ? '""' : 0)).join(', ') %>;<!--
        -->
        var _line = <%= lines[0][0]%>;
        while ( this.status === 'running' ) {
          if ( Math.random() < 0.1 ) await new Promise(r => this.setTimeout(r, 0));
          // console.log(_line);
          switch ( _line ) {
          <% for ( var i = 0 ; i < lines.length ; i++ ) {
            var line = lines[i];
            %><!--
            -->case <%=line[0]%>: <!--
            --><% for ( var j = 0 ; j < line[2].length ; j++ ) {
              var stmt = line[2][j];
            %><!--
              --><%=stmt%><!--
            --><%}%>
          <%}%>
          return;
          }
        }
      }`
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.basic',
  name: 'Stdlib',

  methods: [
    function ABS(n) { return Math.abs(n); },
    function ASC(s) { return s.charCodeAt(0); },
    function CHR$(c) { return String.fromCharCode(c); },
    function COS(n) { return Math.cos(n); },
    function DIM(v, ...dims) {
      function f(v, i, dims) { return i == dims.length ? v : Array(dims[i]+1).fill().map(a => f(v, i+1, dims)); }
      return f(v, 0, dims);
    },
    function EXP(n) { return Math.exp(n); },
    function INT(n) { return Math.floor(n); },
    function LEFT$(s, n) { return s.substring(0, n); },
    function LEN(s) { return s.length; },
    function LOG(n) { return Math.log(n); },
    function MID$(s, b, n) { return s.substring(b-1, b+n-1); },
    function RANGE(i, end, incr) { return incr > 0 ? i <= end : i >= end },
    function RIGHT$(s, n) { return s.substring(s.length-n); },
    function RND(n) { return Math.random(); },
    function SGN(n) { return Math.sign(n); },
    function SIN(n) { return Math.sin(n); },
    function SQR(n) { return Math.sqrt(n); },
    function STR$(n) { return n.toString(); },
    function TAN(n) { return Math.tan(n); },
    function VAL(s) { return parseFloat(s); }
  ]
});


// TODO: configure left editor for VBScript and right for Javascript
foam.CLASS({
  package: 'foam.demos.basic',
  name: 'Terminal',
  extends: 'foam.u2.tag.TextArea',

  requires: [ 'foam.audio.Beep' ],

  imports: [ 'setTimeout' ],

  constants: { BLOCK_CURSOR: '\u2588' },

  documentation: 'Simple web based terminal emulator / BIOS.',

  css: `
  @font-face {
    font-family: '5x7_dot_matrixregular';
    src: url('5x7-dot-matrix-webfont.eot');
    src: url('5x7-dot-matrix-webfont.eot?#iefix') format('embedded-opentype'),url('5x7-dot-matrix-webfont.woff') format('woff'),url('5x7-dot-matrix-webfont.ttf') format('truetype');
    font-weight: normal;
    font-style: normal
  }

  ^ {
    font-family: "5x7_dot_matrixregular",courier,monospace;
    background: #121 !important;
    border-radius: 40px;
    color: #0f0 !important;
    font-size: 10px !important;
    line-height: 14px;
    margin: 8px;
    padding: 15px;
    width: auto !important;
  }
  `,

  properties: [
    { class: 'String', name: 'inp' },
    { class: 'String', name: 'out',    value: 'READY.\n' },
    'cursor',
    { name: 'data', expression: function(out, inp, cursor) { return out + inp + cursor; } },
    [ 'rows', 32 ],
    [ 'cols', 80 ],
    [ 'mode', foam.u2.DisplayMode.RO ]
  ],

  methods: [
    function render() {
      this.SUPER();

      this.out$.sub(() => this.el_().then(e => e.scrollTop = e.scrollHeight));

      this.
        on('keypress', this.keypress).
        on('keyup',    this.keyup);

      this.blink();
    },

    function CLS() { this.out = ''; },

    function NL() { this.out += '\n'; },

    function INPUT() { return this.INPUT$().then(s => parseFloat(s)); },

    function INPUT$() {
      this.focus();
      this.inp = '';
      return new Promise(r => {
        var l = () => {
          if ( this.inp.endsWith('\n') || this.inp.endsWith(',') ) {
            var ret = this.inp.substring(0, this.inp.length-1);
            this.out += this.inp;
            this.inp = '';
            r(ret);
          } else {
            this.inp$.sub(foam.events.oneTime(l));
          }
        };
        l();
      });
    },

    function PRINT(s) { this.out += typeof s === 'number' ? ` ${s} ` : s; },

    function TAB(n) {
      var pos = this.out.length - Math.max(0, this.out.lastIndexOf('\n'));
      n = n === undefined ? pos + ((14 - (pos % 14)) || 14) : Math.round(n);
      this.out += ' '.repeat(Math.max(0, n-pos));
    },

    function SOUND(f, d) {
      this.Beep.create({frequency: f, duration: d*60}).play();
      return new Promise(r => this.setTimeout(r, d*60));
    }
  ],

  listeners: [
    {
      name: 'keypress',
      code: function(e) {
        // if ( e.ctrlKey && e.key === 'c' ) throw "TERMINATED"; // TODO: terminate
        this.inp += e.key === 'Enter' ? '\n' : e.key.toUpperCase();
        e.preventDefault();
      }
    },
    {
      name: 'keyup',
      code: function(e) {
        if ( e.key === 'Backspace' ) this.inp = this.inp.substring(0, this.inp.length-1);
        e.preventDefault();
      }
    },
    {
      name: 'blink',
      isMerged: true,
      mergeDelay: 333,
      code: function() {
        this.cursor = this.cursor === this.BLOCK_CURSOR ? ' ' : this.BLOCK_CURSOR;
        this.blink();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.basic',
  name: 'Basic',
  extends: 'foam.u2.Controller',

  requires: [ 'foam.demos.basic.Terminal', 'foam.demos.basic.Compiler' ],

  imports: [ 'setTimeout' ],

  css: `
  body { font-family: sans-serif; }

  ^ .property-program { display: inline-flex; }

  ^ .property-program select { font-size: 12px !important; }

  ^ button { padding-top: 6px; }

  ^ textarea { font-size: 10px; }

  ^ .property-sourceCode, ^ .property-targetCode {
    display: inline-flex;
    padding: 6px;
    width: 48%;
  }
`,

  properties: [
    {
      name: 'program',
      view: { class: 'foam.u2.view.ChoiceView', choices: foam.demos.basic.Programs.PROGRAMS },
      postSet: function(o, n) {
        // The replaceAll() is because the Ace editor uses \r\n endlines but the parser expects \n
        this.sourceCode = n.trim().replaceAll('\r\n', '\n');
      }
    },
    // If you don't want to use the Ace code editor, then remove the 'xxx's from the next two lines.
    { class: 'Code', name: 'sourceCode', xxxview: { class: 'foam.u2.tag.TextArea', rows: 24, cols: 80 } },
    { class: 'Code', name: 'targetCode', xxxview: { class: 'foam.u2.tag.TextArea', rows: 24, cols: 80 } },
    { name: 'rom', factory: function() { return foam.demos.basic.Stdlib.create({}, this); } },
    'terminal',
    'status'
  ],

  methods: [
    function render() {
      this.addClass().start().add('Load: ').style({display:'inline-flex', padding: '10px'}).end().add(this.PROGRAM, ' ', this.COMPILE, this.RUN, this.STOP).br().add(this.SOURCE_CODE, this.TARGET_CODE).
      start('center').tag(this.Terminal, {}, this.terminal$).end();
    }
  ],

  actions: [
    {
      name: 'compile',
      code: function() {
        this.targetCode = this.Compiler.create().parseString(this.sourceCode.trim()) || '';
      }
    },
    {
      name: 'run',
      label: '▶ Run',
      isEnabled: function(targetCode) { return targetCode.length; },
      code: async function() {
        try {
          var fn;
          with ( this.terminal ) { with ( this.rom ) { fn = eval('(' + this.targetCode + ')'); } }
          // for ( var i = 0 ; i < 10 ; i++ ) await fn.call(this);
          console.time('run');
          this.terminal.CLS();
          this.status = 'running';
          await fn.call(this);
          this.terminal.PRINT("\n" + this.terminal.OUT.value);
        } catch(x) {
          this.terminal.PRINT('SYNTAX ERROR: ' + x);
        } finally {
          this.status = '';
          console.timeEnd('run');
        }
      }
    },
    {
      name: 'stop',
      label: '◼ Stop',
      isEnabled: function(status) { return status === 'running'; },
      code: function() { this.status = ''; }
    }
  ]
});
