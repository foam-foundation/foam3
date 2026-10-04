/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// https://developer.arm.com/documentation/dui0497/a/the-cortex-m0-instruction-set/instruction-set-summary?lang=en
// https://gab.wallawalla.edu/~curt.nelson/cptr380/textbook/advanced%20material/Appendix_B1.pdf
// https://gab.wallawalla.edu/~curt.nelson/cptr380/textbook/advanced%20material/Appendix_B2.pdf
// https://azeria-labs.com/assembly-basics-cheatsheet/

/*
Lm Low register in range r0 to r7
Ln
Ld
Ld/Ln
Lm/Ls
Hm&7 high register  in range r8 to r15 bitwise anded with 7 0b0111, ie. without high-order bit
Rm Register in range r0 to r15
immed5
immed8
register_list, cond< 1110, immed7
*/

foam.CLASS({
  package: 'foam.demos.m0',
  name: 'Instr',

  imports: [
    'm0'
  ],

  methods: [
    function emit() {
      console.log('Emitting: ' + this);
      this.m0.emit(this);
    },
    function toString() {
      return this.cls_.name + '(' + this.cls_.getAxiomsByClass(foam.lang.Property).map(p => p.get(this)).join(',') + ')';
    },
    function toBinary() {
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.m0',
  name: 'Label',

  properties: [
    'name',
    { name: 'addr', value: 'unresolved' }
  ],

  methods: [
    function toString() {
      return this.addr + '<' + this.name + '>';
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.m0',
  name: 'L',
  extends: 'foam.lang.Property',

  static: [
    function test(value) {
      return foam.lang.LowRegister.isInstance(value);
    }
  ],

  methods: [
    function emit(value) {
      return value; // TODO: output in binary
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.m0',
  name: 'R',
  extends: 'foam.lang.Property',

  static: [
    function test(value) {
      return foam.lang.HighRegister.isInstance(value);
    }
  ],

  methods: [
    function emit(value) {
      return value; // TODO: output in binary
    }
  ]
});


[ 3, 5, 7, 8 ].forEach(i => { const max = Math.pow(2, i);
foam.CLASS({
  package: 'foam.lang',
  name: 'Immed' + i,
  extends: 'foam.lang.Property',

  static: [
    function test(value) {
      return Number.isInteger(value) && value >= 0 && value < max;
    }
  ],

  methods: [
    function emit(value) {
      return value; // TODO: output in binary
    }
  ]
})});

foam.CLASS({
  package: 'foam.lang',
  name: 'LowRegister',
  extends: 'foam.lang.Int',
  description: 'A marker class so we can easily tell which registers are low.'
});

foam.CLASS({
  package: 'foam.lang',
  name: 'HighRegister',
  extends: 'foam.lang.Int',
  description: 'A marker class so we can easily tell which registers are high.'
});



var INSTRS = [
//  [ 'MOV',   16, [ 'dst', 'src' ],    function() { this.dst.set(this.m0, this.src); } ],
  [ 'MOV',   16, [ 'dst', 'src' ],    function() { this.dst.set(this.m0, this.src); } ],
  [ 'ADD',   16, [ 'dst', 'amt' ],    function() { this.dst.set(this.m0, this.dst.get(this.m0) + this.amt); } ],
  [ 'SUB',   16, [] ],
  [ 'SUBC',  16, [] ],
  [ 'B',     0, [ 'addr' ], function() { this.m0.r15 = this.addr.addr; } ],
];

var INSTRS2 =  [
//  [ 'ADC',  'Add with carry', '0100000101', 'Lm/Ls', 'Ld' ],

  [ 'ADD',  'L = L + L', 'L m,L n,L d', '0001100,m,n,d', 16,
  function() { this.d.set(this.m0, this.d.get(this.m0) + this.n.get(this.m0) + this.m.get(this.m0)); } ],

  [ 'ADD',  '', 'Immed3 i,L n,L d', '0001110,immed3,n,d', 16,
    function() { this.d.set(this.m0, this.d.get(this.m0) + this.n.get(this.m0) + this.immed); } ],

/*
  [ 'ADD',  '', '00110', 'Ld', 'immed8',
    function() { this.d.set(this.m0, this.d.get(this.m0) + this.immed); } ],

  [ 'ADD',  '', '0100010001', 'Hm&7', 'Ld',
  function() { this.d.set(this.m0, this.d.get(this.m0) + this.m.get(this.m0)); }  ],

  [ 'ADD',  '', '0100010010', 'Lm', 'Hd&7',
  function() { this.d.set(this.m0, this.d.get(this.m0) + this.m.get(this.m0)); }  ],

  [ 'ADD',  '', '0100010011', 'Hm&7', 'Hd&7',
  function() { this.d.set(this.m0, this.d.get(this.m0) + this.m.get(this.m0)); }  ],

  [ 'ADD',  '', '1010', 'pc|sp', 'Ld', 'immed8' ],
  [ 'ADD',  '', '101100000', 'immed7' ],
  [ 'AND',  'Logical AND', '0100000000', 'Lm/Ls', 'Ld' ],
  [ 'ASR',  '', '00010', 'immed5', 'Lm', 'Ld' ],
  [ 'ASR',  '', '0100000100', 'Lm/Ls', 'Ld' ],
  [ 'B',    'Branch', '0', 'elevenbitoffset' ],
  [ 'BCC',  'Branch Carry Clear', '11010011', 'eightbitoffset' ], // Alias: BLO  unsigned LOwer C == 0
  [ 'BCS',  'Branch Carry Set', '11010010', 'eightbitoffset' ], // Alias: BHS unsigned Higher or Same C == 1
  [ 'BEQ',  'Branch EQual', '11010000', 'eightbitoffset' ],
  [ 'BGE',  'Branch Greater than or Equal', '11011010', 'eightbitoffset' ],
  [ 'BGT',  'Branch Greater Than', '11011100', 'eightbitoffset' ],
  [ 'BHI',  'Branch unsigned HIgher', '11011000', 'eightbitoffset' ],
  [ 'BIC',  'Logical BIt Clear', '0100001110', 'Lm', 'Ld' ],
  [ 'BKPT', '', '10111110', 'immed8' ],
  [ 'BL',   '', '11111', 'unsignedelevenbitoffset' ],
  [ 'BLE',   'Branch signed Less than or Equal', '11011101', 'eightbitoffset' ],
  [ 'BLS',   'Branch unsigned Lower or Same', '11011001', 'eightbitoffset' ],
  [ 'BLT',   'Branch signed Less Than', '11011011', 'eightbitoffset' ],
  [ 'BLX',   '', '010001111', 'Rm', '000' ],
  [ 'BLX',   '', '11101', 'unsignedtenbitoffset' ],
  [ 'BMI',   'Branch MInus', '11010100', 'eightbitoffset' ],
  [ 'BNE',   'Branch Not Equal', '11010001', 'eightbitoffset' ],
  [ 'BPL',   'Branch PLus', '11010101', 'eightbitoffset' ],
  [ 'BVC',   'Branch V flag Clear', '11010111', 'eightbitoffset' ],
  [ 'BVS',   'Branch V flag Set', '11010110', 'eightbitoffset' ],
  [ 'BX',    '', '010001110', 'Rm', '000' ],
  [ 'CMN',   '', '0100001011', 'Lm', 'Ld/Ln' ],
  [ 'CMP',   '', '00101', 'Ld/Ln', 'immed8' ],
  [ 'CMP',   '', '0100001010', 'Lm', 'Ld/Ln' ],
  [ 'CMP',   '', '0100010101', 'Hm&7', 'Ln' ],
  [ 'CMP',   '', '0100010110', 'Lm', 'Hn&7' ],
  [ 'CMP',   '', '010001011', 'Hm&7', 'Hn&7' ],
  [ 'CPSIE', '', '1011011001100', 'a', 'i', 'f' ],
  [ 'CPY',   '', '0100011000', 'Lm', 'Ld' ],
  [ 'EOR',   'Logical Exclusive-OR', '0100000001', 'Lm/Ls', 'Ld' ],
  [ 'LDMIA', '', '11001', 'Ln', 'register_list' ],
  [ 'LDR',   '', '01001', 'Ld', 'immed8' ],
  [ 'LDR',   '', '0101100', 'Lm', 'Ln', 'Ld' ],
  [ 'LDR',   '', '01101', 'immed5', 'Ln', 'Ld' ],
  [ 'LDR',   '', '10011', 'Ld', 'immed8' ],
  [ 'LDRB',  '', '0101110', 'Lm', 'Ln', 'Ld' ],
  [ 'LDRB',  '', '01111', 'immed5', 'Ln', 'Ld' ],
  [ 'LDRH',  '', '0101101', 'Lm', 'Ln', 'Ld' ],
  [ 'LDRH',  '', '10001', 'immed5', 'Ln', 'Ld' ],
  [ 'LDRSB', '', '0101011', 'Lm', 'Ln', 'Ld' ],
  [ 'LDRSH', '', '0101111', 'Lm', 'Ln', 'Ld' ],
  [ 'LSL',   '', '00000', 'immed5', 'Lm', 'Ld' ],
  [ 'LSL',   '', '0100000010', 'Lm/Ls', 'Ld' ],
  [ 'LSR',   '', '00001', 'immed5', 'Lm', 'Ld' ],
  [ 'LSR',   '', '0100000011', 'Lm/Ls', 'Ld' ],
  [ 'MOV',   '', '00100', 'Ld/Ln', 'immed8' ],
  [ 'MOV',   '', '0100011001', 'Hm&7', 'Ld' ],
  [ 'MOV',   '', '0100011010', 'Lm', 'Hd&7' ],
  [ 'MOV',   '', '0100011011', 'Hm&7', 'Hd&7' ],
  [ 'MUL',   '', '0100001101', 'Lm', 'Ld' ],
  [ 'MVN',   'Logical Move Not', '0100001111', 'Lm', 'Ld' ],
  [ 'NEG',   '', '0100001001', 'Lm', 'Ld/Ln' ],
  [ 'ORR',   'Logical OR', '0100001100', 'Lm', 'Ld' ],
  [ 'POP',   '', '1011110', 'R', 'register_list' ],
  [ 'PUSH',  '', '1011010', 'R', 'register_list' ],
  [ 'REV',   '', '1011101000', 'Lm<Ld' ],
  [ 'REV16', '', '1011101001', 'Lm<Ld' ],
  [ 'REVSH', '', '1011101011', 'Lm<Ld' ],
  [ 'ROR',   '', '0100000111', 'Lm/Ls', 'Ld' ],
  [ 'SBC',   '', '0100000110', 'Lm/Ls', 'Ld' ],
  [ 'SETEND BE', 'Set to Big-Endian', '1011011001011000' ],
  [ 'SETEND LE', 'Set to Little-Endian', '1011011001010000' ],
  [ 'SPSID', '', '1011011001110', 'a', 'i', 'f' ],
  [ 'STMIA', '', '11000', 'Ln', 'register_list' ],
  [ 'STR',   '', '0101000', 'Lm', 'Ln', 'Ld' ],
  [ 'STR',   '', '01100', 'immed5', 'Ln', 'Ld' ],
  [ 'STR',   '', '10010', 'Ld', 'immed8' ],
  [ 'STRB',  '', '0101010', 'Lm', 'Ln', 'Ld' ],
  [ 'STRB',  '', '01110', 'immed5', 'Ln', 'Ld' ],
  [ 'STRH',  '', '0101001', 'Lm', 'Ln', 'Ld' ],
  [ 'STRH',  '', '10000', 'immed5', 'Ln', 'Ld' ],
  [ 'SUB',   '', '0001101', 'Lm', 'Ln', 'Ld' ],
  [ 'SUB',   '', '0001111', 'immed3', 'Ln', 'Ld' ],
  [ 'SUB',   '', '00111', 'Ld', 'immed8' ],
  [ 'SUB',   '', '101100001', 'immed7' ],
  [ 'SWI',   '', '11011110', 'x' ],
  [ 'SXTB',  '', '1011001001', 'Lm', 'Ld' ],
  [ 'SXTH',  '', '1011001000', 'Lm', 'Ld' ],
  [ 'TST',   'Logical Test bits', '0100001000', 'Lm', 'Ld/Ln' ],
  [ 'UXTB',  '', '1011001011', 'Lm', 'Ld' ],
  [ 'UXTH',  '', '1011001010', 'Lm', 'Ld' ]
  */
];


// ARITHMETIC: ADD ADC SUB SBC NEG MUL
// CMP CMN
// SHIFT + ROTATION: LSL ASR ROR
// CONDITIONAL CODES: EQ NE CS/HS CC/LO MI PL VS VC HI LS GE LT GT LE AL
// Logical Operators: AND EOR ORR BIC MVN TST
// STACK: PUSH POP
// NOP

INSTRS.forEach(i => foam.CLASS({
  package: 'foam.demos.m0',
  name: i[0],
  extends: 'foam.demos.m0.Instr',

  properties: i[2],

  methods: [
    function execute() {
      i[3].call(this);
      this.m0.r15 += i[1];
    }
  ]
}));

const I2S = [];

INSTRS2.forEach(a => {
  var [ name, desc, props, pattern, size, fn ] = a;
  props = props.split(',');
  var clsName = name + props.map(p => p.split(' ')[0]).join('');

  var model = {
    package: 'foam.demos.m0',
    name: clsName,
    extends: 'foam.demos.m0.Instr',

    static: [
      function matches(p) {
        return true;
      }
    ],

    properties: props.map(p => {
      var [cl, name] = p.split(' ');
      if ( cl === 'L' ) cl = 'LowRegister';
      return {
        class: cl,
        name: name
      };
    }),

    methods: [
      function execute() {
        fn.call(this);
        this.m0.r15 += size;
      }
    ]
  };
  console.log('DEFINING', clsName, a, model);
  foam.CLASS(model);

  I2S.push(foam.lookup('foam.demos.m0.' + clsName));
});

function i2(...args) {
  for ( var i = 0 ; i < I2S.length ; i++ ) {
    var cls = I2S[i];

    if ( cls.matches(args) ) {
      console.log('*** MATCH', args, ls.name);

      var inst = cls.create();
      return inst;
    }
  }
}

foam.CLASS({
  package: 'foam.demos.m0',
  name: 'M0',
  extends: 'foam.u2.Controller',

  requires: [
    ...INSTRS.map(i => 'foam.demos.m0.' + i[0] + ' as ' + i[0] + '_I'),
    'foam.demos.m0.Label'
  ],

  exports: [
    'as m0'
  ],

  css: `
    <<selected { xxxbackground: lightgray; border: 2px solid red; background: #eee; }
    << textarea { font-family: monospace; }
  `,

  properties: [
    {
      name: 'mem',
      factory: () => []
    },
    {
      name: 'labels',
      factory: function() { return {}; }
    },
    {
      class: 'Int',
      name: 'cp',
      description: 'Code Pointer: position to put next instruction when compiling'
    },
    {
      class: 'String',
      name: 'code',
      view: { class: 'foam.u2.tag.TextArea', rows: 29, cols: 40 },
      value: `// Demo Program

  MOV(R0, 100);
LABEL('START');
  ADD(R0, 1);
  B('START');
      `
    },
    // r0-r3 functions can use without saving
    { class: 'LowRegister', name: 'r0' },
    { class: 'LowRegister', name: 'r1' },
    { class: 'LowRegister', name: 'r2' },
    { class: 'LowRegister', name: 'r3' },
    { class: 'LowRegister', name: 'r4' },
    { class: 'LowRegister', name: 'r5' },
    { class: 'LowRegister', name: 'r6' },
    { class: 'LowRegister', name: 'r7' },
    // r8-r11 unavailable on thumb
    { class: 'HighRegister', name: 'r12', shortName: 'IP' }, // Intraprocedure call scratch register
    { class: 'HighRegister', name: 'r13', shortName: 'SP' }, // Stack Pointer
    { class: 'HighRegister', name: 'r14', shortName: 'LR' }, // Link Register
    { class: 'HighRegister', name: 'r15', shortName: 'PC' }, // Program Counter
    // CPSR
  ],

  methods: [
    function render() {
      var self = this;

      this.addClass(this.myClass()).
      start().
        style({display: 'flex'}).
        start().
//          start('h4').add('Assembly:').end().
          add(this.COMPILE, this.STEP, this.RUN).
          br().br().
          add(this.CODE).
        end().
        start().
          style({padding: '0 12px'}).
          start('h4').add('Registers:').end().
          start('table').
            call(function() {
              for ( var i = 0 ; i < 16 ; i++ ) {
                this.start('tr').
                  start('th').add('R' + i).end().
                  start('td').add(self['R' + i]).end().
                  start('th').add(self['R' + i].shortName).end();
                if ( i == 7 ) i = 11; // Skip 8-11
              }
            }).
          end().
        end().
        start().
          start('h4').add('Memory:').end().
          start('table').
            start('tr').
              start('th').add('Addr.').end().
              start('th').add('Instr.').end().
            end().
            add(this.dynamic(function(mem) { mem.forEach((m, i) => {
              this.start('tr').
                enableClass(self.myClass('selected'), self.r15$.map(r15 => r15 === i)).
                start('td').add(i).end().
                start('td').add(m.toString()).end().
              end();
            })})).
          end().
        end().
      end().
      br()
      ;
    },

    function emit(instr, opt_size) {
      this.mem[this.cp] = instr;
      this.cp += opt_size || 16;
    },

    function MOV(r, n) {
      this.MOV_I.create({dst: r, src: n}).emit();
    },

    function ADD(r, n) {
      this.ADD_I.create({dst: r, amt: n}).emit();
    },

    function getLabel(n) {
      return this.labels[n] || (this.labels[n] = this.Label.create({name: n}));
    },

    function LABEL(n) {
      this.getLabel(n).addr = this.cp;
    },

    function B(l) {
      this.B_I.create({addr: this.getLabel(l)}).emit();
    }
  ],

  actions: [
    function compile() {
      this.cp = 0;
      this.memory = [];
      with ( {
        R0:    this.R0,
        R1:    this.R1,
        R2:    this.R2,
        R3:    this.R3,
        R4:    this.R4,
        R5:    this.R5,
        R6:    this.R6,
        R7:    this.R7,
        R12:   this.R12,
        R13:   this.R13,
        R14:   this.R14,
        R15:   this.R15,
        IP:    this.R12,
        SP:    this.R13,
        LR:    this.R14,
        PC:    this.R15,
        ADD:   this.ADD.bind(this),
        B:     this.B.bind(this),
        LABEL: this.LABEL.bind(this),
        MOV:   this.MOV.bind(this),
      } ) {
        console.log('Compiling: ', this.code);
        eval(this.code);
        this.propertyChange.pub('mem');
      }
    },
    function step() {
      var instr = this.mem[this.r15];
      if ( ! instr ) return;
      console.log(`STEP: ${i} IP: ${this.r15} INSTR: ${instr.cls_.name}`);
      instr.execute();
    },
    function run() {
      this.r15 = 0;
      for ( var i = 0 ; i < 100 ; i++ ) {
        this.step();
      }
    }
  ]
});
