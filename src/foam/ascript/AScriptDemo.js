/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/*
  End-to-end harness for AScriptParser. Load AFTER:
    1. the parent .ext merge fix in SimpleQueryParser.grammar_
    2. foam.parse.AScriptParser (and foam.parse.FnExpr)

  Run: node with FOAM bootstrapped, or paste into a browser console on a page
  that has FOAM loaded. Prints parsed MLang + evaluated value + PASS/FAIL.
*/

setTimeout(function() {
foam.CLASS({
  package: 'foam.ascript',
  name: 'Address',

  properties: [ 'city', 'province' ]
});


foam.CLASS({
  package: 'foam.ascript',
  name: 'Test',

  properties: [
    { class: 'Int',            name: 'id' },
    { class: 'String',         name: 'firstName' },
    { class: 'String',         name: 'lastName' },
    { class: 'Float',          name: 'balance' },
    { class: 'DateTime',       name: 'born' },
    { class: 'FObjectProperty', of: 'foam.ascript.Address', name: 'address' }
  ]
});


foam.CLASS({
  package: 'foam.ascript',
  name: 'AScriptDemo',
  requires: [ 'foam.ascript.AScriptParser', 'foam.ascript.Test' ],
  methods: [
    function run() {
      var p = this.AScriptParser.create({ of: this.Test });

      var born = new Date();
      born.setFullYear(born.getFullYear() - 20);
      born.setHours(9, 30, 0, 0);

      var data = this.Test.create({
        id: 42, firstName: 'Kevin', lastName: 'Greer', balance: 1500,
        born: born, address: { city: 'Toronto', province: 'ON' }
      });

      function pad(s) { return (s + '                                          ').slice(0, 42); }

      function exPart(s, expected, sym) {
        try {
          let parser = p.grammar_.getSymParser(sym);

          var e   = parser.parseString(s);
          console.log('*****', s, ' -> ' , e);
          var out = ( e && e.f ) ? e.f(data) : e;
          var tag = expected === undefined ? ''
              : (out === expected ? '  PASS' : '  FAIL (expected ' + JSON.stringify(expected) + ')');
          console.log(pad(s), '->', (e ? e.toString() : '(no parse)'), '=', JSON.stringify(out) + tag);
//          if ( out !== expected ) debugger;
        } catch (err) {
          console.log(pad(s), '-> ERROR:', (err && err.message) || err);
//          debugger;
        }
      }

      function ex(s, expected) {
        try {
          var e   = p.parseExpression(s);
          console.log('*****', s, ' -> ' , e);
          var out = ( e && e.f ) ? e.f(data) : e;
          var tag = expected === undefined ? ''
              : (out === expected ? '  PASS' : '  FAIL (expected ' + JSON.stringify(expected) + ')');
          try {
            console.log(pad(s), '->', (e ? e.toString() : '(no parse)'), '=', JSON.stringify(out) + tag);
          } catch (x) {
            // In case 'out' has circular references and can't be output as JSON
            console.log(pad(s), '->', (e ? e.toString() : '(no parse)'), '=', out, tag);
          }
//          if ( out !== expected ) debugger;
        } catch (err) {
          console.log(pad(s), '-> ERROR:', (err && err.message) || err);
//          debugger;
        }
      }

      ex('LPAD(firstName, 12, "X")', "XXXXXXXKevin");
      ex('LPAD(firstName, 12)', "0000000Kevin");

      ex('RPAD(firstName, 12, "X")', "KevinXXXXXXX");
      ex('RPAD("11111", 12)', "111110000000");

      ex('CONCAT(true, false)', 'truefalse');
      ex('IFS(true, 42)', 42);
      ex('IFS(balance > 200, "high")', 'high');
      ex('IFS(balance > 1000, "high", balance > 500, "medium", true, "low")', 'high');
      ex('CONCAT("abc","def")', "abcdef");

      /*
      exPart('true', 1, 'number');

      ex('IF(true, "true", "false")', 1);
      ex('IF(true, 1, 0)', 1);
      ex('IF(1 = 2, "true", "false")', 1);
      ex('IF("abc" = "def", 1, 0)', 1);
      ex('IF(balance > 1000, "high", "low")', 'high');
      ex('IF(id = 42, firstName, lastName)', 'Kevin');
      ex('IF(balance > 1000, balance * 2, 0)', 3000);

      console.log('── test parts ──');
      exPart('1', 1, 'number');
      exPart('12', 12, 'primary');
      exPart('"abc"', 'abc', 'primary');
      exPart('"def"', 'def', 'quoted string');
      exPart('true', true, 'primary');
      exPart('false', false, 'primary');
      exPart('3^2', 9, 'power');
      exPart('-2', -2, 'neg');
      exPart('-3^2', 9, 'unary'); // Not Excel compatible
      exPart('1+2', 3, 'addsub');
      exPart('2-1', 1, 'addsub');
      exPart('2*3', 6, 'muldiv');
      exPart('2*4', 8, 'concat');
      exPart('city', 'city', 'ident');
      */

      console.log('── leaves ──');
      ex('12', 12);
      ex('13', 13);
      ex('"abc"', 'abc');
      ex('"def"', 'def');
      ex('true', true);
      ex('false', false);

      console.log('── power / unary ──');
      ex('3^2', 9);
      ex('-2', -2);
      ex('-3^2', -9);
      ex('2 ^ -3', 0.125);

      console.log('── mul / add / concat (numeric) ──');
      ex('2*3', 6);
      ex('2*4', 8);
      ex('1+2', 3);
      ex('2-1', 1);
      ex('2 + 3 * 4', 14);
      ex('(2 + 3) * 4', 20);
      ex('10 / 4', 2.5);

      console.log('── associativity (left-assoc via fold) ──');
      ex('10-2-3', 5);      // SUB(SUB(10,2),3)
      ex('100/10/2', 5);    // DIV(DIV(100,10),2)

      console.log('── fields & dotted access ──');
      ex('id', 42);
      ex('firstName', 'Kevin');
      ex('balance * 2', 3000);
      ex('address.city', 'Toronto');

      console.log('── functions ──');
      ex('LEN(firstName)', 5);
      ex('LEFT(firstName, 3)', 'Kev');
      ex('UPPER(lastName)', 'GREER');
      ex('UPPER(address.city)', 'TORONTO');

      console.log('── concat over strings ──');
//      ex('firstName + lastName', 'KevinGreer');
//      ex('"Hello, " + firstName', 'Hello, Kevin');
//      ex('firstName + "!"', 'Kevin!');
//      ex('firstName + " " & lastName', 'Kevin Greer');
//      ex('LEFT(firstName, 3) + "."', 'Kev.');

      console.log('── IF ──');
      ex('IF(true, 1, 0)', 1);
      ex('IF(false, 1, 0)', 0);
      ex('IF(balance > 1000, "high", "low")', 'high');
      ex('IF(id = 42, firstName, lastName)', 'Kevin');
      ex('IF(balance > 1000, balance * 2, 0)', 3000);

      console.log('── IFS ──');
      ex('IFS(firstName="Kevin",1)', 1);
      ex('IFS(balance > 1000, "high", balance > 500, "medium", true, "low")', 'high');

      console.log('── date fn (printed, not asserted) ──');
      ex('YEARS(born)', 20);

      console.log('── should NOT parse ──');
//      ex('BOGUS(1)');
//      ex('LEFT("x")'); // TODO: does compile

      console.log('── new lib mlangs: diff / fix / currency / MID / SUBSTR ──');

      // diff — absolute difference, mixed int/float args
      ex('DIFF(10, 3)', 7);
      ex('DIFF(3, 10)', 7);              // order-independent (abs)
      ex('DIFF(balance, 2000)', 500);    // Float prop vs int literal -> cast prelude exercised
      ex('DIFF(id, 50)', 8);             // both ints through Float-typed args

      // fix — fixed decimals, returns a STRING (toFixed / String.format)
      ex('FIX(3.14159, 2)', '3.14');
      ex('fIX(balance, 2)', '1500.00');
      ex('fIX(2.5)', '3');               // precision defaults to 0 (value:0)  -> "2" or "3"? see note
      ex('FIX(2.4)', '2');
      ex('FIX(3)', '3');

      // currency — grouped, precision default 2; US-locale expectation
      ex('CURRENCY(1234.5)', '1,234.5'); // maximumFractionDigits:2, no trailing zero pad
      ex('CURRENCY(1234.567, 2)', '1,234.57');
      ex('CURRENCY(balance)', '1,500');

      // MID — Excel: 1-based, third arg is LENGTH
      ex('MID(firstName, 2, 3)', 'evi');   // chars 2..4
      ex('MID(firstName, 1, 2)', 'Ke');
      ex('MID(firstName, 4, 99)', 'in');   // len past end -> clamped
      ex('MID(firstName, 10, 3)', '');     // start past end -> empty

      // SUBSTR — JS: 0-based, third arg is END (exclusive)
      ex('SUBSTR(firstName, 1, 3)', 'ev'); // [1,3)
      ex('SUBSTR(firstName, 0, 2)', 'Ke');
      ex('SUBSTR(firstName, 2)', 'vin');   // end omitted -> to end (value:-1 sentinel)
      ex('SUBSTR(firstName, 10)', '');     // start past end -> clamped empty

      // MID vs SUBSTR: same window, different conventions, same result
      ex('MID(firstName, 2, 2)', 'ev');    // 1-based start 2, len 2
      ex('SUBSTR(firstName, 1, 3)', 'ev'); // 0-based [1,3)   -> both "ev"

    }
  ]
});

// auto-run if a context is available
try { foam.ascript.AScriptDemo.create().run(); } catch (e) {}

}, 5000);
