# FOAM Parser Callback System - Deep Dive

This document explains how the FOAM parser callback system works, including error handling, with visual diagrams.

---

## Table of Contents

- [The Core Architecture](#the-core-architecture)
- [Two Key Callback Mechanisms](#two-key-callback-mechanisms)
  - [The `apply` Callback (Low-Level Interception)](#1-the-apply-callback-low-level-interception)
  - [Semantic Actions (Symbol-Level Transformation)](#2-semantic-actions-symbol-level-transformation)
- [How Errors Work](#how-errors-work)
  - [Basic Error Detection](#basic-error-detection)
  - [Finding WHERE the Error Occurred](#finding-where-the-error-occurred)
  - [Built-in Error Reporting](#built-in-error-reporting-grammargetlasterror)
- [Visual Flow: What Happens When You Parse](#visual-flow-what-happens-when-you-parse)
- [Real Examples](#real-examples)
  - [Empty File Detection](#example-1-empty-file-detection)
  - [Detailed Error Reporting](#example-2-detailed-error-reporting)
  - [Using Apply for Debugging](#example-3-using-apply-for-debugging)
- [Key Files Reference](#key-files-reference)

---

## The Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PARSING FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Input String ──► StringPStream ──► Parser ──► Result/undefined │
│                         │                                        │
│                         ▼                                        │
│                   apply(parser, grammar)                         │
│                   (intercepts EVERY parse call)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Description | File Location |
|-----------|-------------|---------------|
| **StringPStream** | Immutable stream of characters with position tracking | `foam/parse/StringPStream.js` |
| **Parser** | Object with `parse(ps, grammar)` method | `foam/parse/parse.js` |
| **Grammar** | Collection of named parsers (symbols) with actions | `foam/parse/parse.js` |
| **apply** | Callback that intercepts every parse operation | `StringPStream.js:85` |

---

## Two Key Callback Mechanisms

### 1. The `apply` Callback (Low-Level Interception)

Every time a parser runs, it doesn't call `parser.parse()` directly. Instead, it calls:

```javascript
ps.apply(parser, grammar)
```

#### Default Behavior

From `StringPStream.js:85`:

```javascript
this.apply = function(p, obj) {
  return p.parse(this, obj);  // Just runs the parser normally
};
```

#### Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                     apply() INTERCEPTION                        │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Parser A                                                      │
│      │                                                          │
│      ▼                                                          │
│   ps.apply(parserB, grammar)  ◄─── YOUR CALLBACK HERE           │
│      │                                                          │
│      │  ┌─────────────────────────────────┐                     │
│      │  │  function(p, grammar) {         │                     │
│      │  │    // 'this' = PStream          │                     │
│      │  │    // 'p' = parser being called │                     │
│      │  │    // Do your interception...   │                     │
│      │  │    return p.parse(this, grammar);│                    │
│      │  │  }                              │                     │
│      │  └─────────────────────────────────┘                     │
│      ▼                                                          │
│   Result (PStream or undefined)                                 │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### Custom Apply Example

```javascript
var myApply = function(p, grammar) {
  // 'this' = the PStream (current position in input)
  // 'p' = the parser being called
  // 'grammar' = the grammar object

  console.log('Parsing at position:', this.pos);
  console.log('Parser:', p.toString());

  var result = p.parse(this, grammar);  // Actually run it

  console.log('Result:', result ? 'SUCCESS' : 'FAILED');
  return result;
};

// Use it:
var ps = foam.parse.StringPStream.create({
  str: 'hello world',
  apply: myApply
});

grammar.parse(ps);
```

#### What You Can Do With `apply`

| Use Case | Description |
|----------|-------------|
| **Debugging** | Log every parser invocation |
| **Error Tracking** | Track maximum position reached |
| **Suggestions** | Collect autocomplete suggestions (SmartView) |
| **Normalization** | Rewrite input to preferred syntax |
| **Performance** | Count parser invocations |

---

### 2. Semantic Actions (Symbol-Level Transformation)

After a grammar symbol parses successfully, you can transform the result using **Action methods**.

#### Naming Convention

```
Symbol Name: "number"
Action Method: "numberAction"
```

#### How It Works

```
┌────────────────────────────────────────────────────────────────┐
│                    SEMANTIC ACTIONS                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Grammar Symbol: 'number'                                      │
│          │                                                      │
│          ▼                                                      │
│   Parser matches "123"                                          │
│          │                                                      │
│          ▼                                                      │
│   value = "123" (string)                                        │
│          │                                                      │
│          ▼                                                      │
│   numberAction(value) called   ◄─── YOUR TRANSFORMATION         │
│          │                                                      │
│          ▼                                                      │
│   return parseInt(value)                                        │
│          │                                                      │
│          ▼                                                      │
│   Final value = 123 (integer)                                   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### Example

```javascript
foam.CLASS({
  name: 'MyGrammar',
  extends: 'foam.parse.Grammar',

  methods: [
    function grammar(seq, sym, range, plus, str) {
      return {
        START: sym('number'),
        number: str(plus(range('0', '9')))
      };
    },

    // This runs AFTER 'number' parses successfully
    function numberAction(v) {
      // v = "123" (string from parser)
      return parseInt(v);  // Return 123 (integer)
    }
  ]
});

var g = MyGrammar.create();
var result = g.parseString('456');
console.log(result);        // 456
console.log(typeof result); // "number"
```

#### Action Registration (Internal)

From `parse.js:1411-1420`:

```javascript
function init() {
  this.SUPER();

  // Add semantic actions for any symbol where there is a method named: <sym>Action
  this.symbols.forEach(s => {
    var m = this[s.name + 'Action'];
    if ( m ) {
      this.addAction(s.name, m.bind(this));
    }
  });
}
```

---

## How Errors Work

> **Key Insight**: FOAM parsers don't throw exceptions. They return `undefined` on failure.

```
┌────────────────────────────────────────────────────────────────┐
│                    ERROR DETECTION                              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   parser.parse(ps, grammar)                                     │
│         │                                                       │
│         ├──► Returns PStream ──► SUCCESS (has .value)           │
│         │                                                       │
│         └──► Returns undefined ──► FAILURE                      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Basic Error Detection

```javascript
var grammar = MyGrammar.create();
var result = grammar.parseString('invalid input');

if ( result === undefined ) {
  console.log('Parse failed!');
} else {
  console.log('Parsed:', result);
}
```

### Finding WHERE the Error Occurred

The trick is to **track the maximum position** reached before failure:

```javascript
var maxPos = 0;
var inputStr = 'hello 123 ???';

var trackingApply = function(p, grammar) {
  // Track furthest position we've reached
  maxPos = Math.max(maxPos, this.pos);
  return p.parse(this, grammar);
};

var ps = foam.parse.StringPStream.create({
  str: inputStr,
  apply: trackingApply
});

var result = myParser.parse(ps, myGrammar);

if ( ! result ) {
  console.log('Error at position:', maxPos);
  console.log('Error near:', inputStr.substring(maxPos, maxPos + 10));
}
```

### Built-in Error Reporting (Grammar.getLastError)

The Grammar class has error reporting built in (`parse.js:1452-1507`):

```javascript
var grammar = MyGrammar.create();
var result = grammar.parseString('bad input');

if ( ! result ) {
  console.log(grammar.getLastError());
  // Output: "Unexpected character 'x' at index: 5, Expected one of: [a,b,c],
  //          Text leading up to this was: ..."
}
```

#### How getLastError Works

```
┌────────────────────────────────────────────────────────────────┐
│                  getLastError() INTERNALS                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. Creates ErrorReportingPStream                              │
│   2. Re-parses with error tracking                              │
│   3. Records [position, parser, grammar] at each failure        │
│   4. Keeps the FURTHEST failure point                           │
│   5. Tests all ASCII chars to find "valid" next characters      │
│   6. Builds human-readable error message                        │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Visual Flow: What Happens When You Parse

```
parseString("abc123")
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ StringPStream created                                         │
│   str: "abc123"                                               │
│   pos: 0                                                      │
│   apply: [your callback or default]                           │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ START symbol looked up from grammar                           │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ ps.apply(startParser, grammar)  ◄── YOUR CALLBACK RUNS HERE   │
│                                                               │
│   Inside apply:                                               │
│     1. Your code runs (logging, tracking, etc.)               │
│     2. p.parse(this, grammar) called                          │
│     3. Parser may call ps.apply() on sub-parsers              │
│     4. Result returned (PStream or undefined)                 │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ If symbol has an Action method:                               │
│   result.value = symbolAction(result.value)                   │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
   Final result.value returned
```

### Detailed Sequence Diagram

```
┌─────────┐     ┌──────────┐     ┌────────┐     ┌─────────┐
│  User   │     │ Grammar  │     │ PStream│     │ Parser  │
└────┬────┘     └────┬─────┘     └────┬───┘     └────┬────┘
     │               │                │              │
     │ parseString() │                │              │
     │──────────────►│                │              │
     │               │                │              │
     │               │ create()       │              │
     │               │───────────────►│              │
     │               │                │              │
     │               │ parse()        │              │
     │               │───────────────►│              │
     │               │                │              │
     │               │                │ apply(p,g)   │
     │               │                │─────────────►│
     │               │                │              │
     │               │                │   [callback  │
     │               │                │    runs]     │
     │               │                │              │
     │               │                │ parse(ps,g)  │
     │               │                │◄─────────────│
     │               │                │              │
     │               │                │   result     │
     │               │                │◄─────────────│
     │               │                │              │
     │               │ action(value)  │              │
     │               │◄───────────────│              │
     │               │                │              │
     │  result.value │                │              │
     │◄──────────────│                │              │
     │               │                │              │
```

---

## Real Examples

### Example 1: Empty File Detection

```javascript
foam.CLASS({
  name: 'FileParser',
  extends: 'foam.parse.Grammar',

  properties: [
    { name: 'errorMessage', value: '' },
    { name: 'errorPos', value: 0 }
  ],

  methods: [
    function grammar(seq, sym, eof, plus, anyChar, alt, not) {
      return {
        START: alt(
          sym('emptyFile'),
          sym('content')
        ),

        emptyFile: eof(),  // Matches if file is empty

        content: seq(
          plus(sym('line')),
          eof()
        ),

        line: plus(not('\n', anyChar()))
      };
    },

    // Action for empty file - returns error object
    function emptyFileAction(v) {
      return {
        error: 'FILE_EMPTY',
        message: 'The file is empty'
      };
    },

    // Main parsing method with error tracking
    function parseWithErrors(str) {
      var self = this;
      self.errorPos = 0;

      var apply = function(p, grammar) {
        self.errorPos = Math.max(self.errorPos, this.pos);
        return p.parse(this, grammar);
      };

      var ps = foam.parse.StringPStream.create({
        str: str,
        apply: apply
      });

      var result = this.parse(ps);

      if ( ! result ) {
        return {
          error: 'PARSE_ERROR',
          message: 'Parse failed at position ' + self.errorPos,
          position: self.errorPos,
          context: str.substring(self.errorPos, self.errorPos + 20)
        };
      }

      return result.value;
    }
  ]
});

// Usage:
var parser = FileParser.create();

var result1 = parser.parseWithErrors('');
// { error: 'FILE_EMPTY', message: 'The file is empty' }

var result2 = parser.parseWithErrors('hello\nworld');
// Parsed content

var result3 = parser.parseWithErrors('hello\x00invalid');
// { error: 'PARSE_ERROR', message: 'Parse failed at position 5', ... }
```

### Example 2: Detailed Error Reporting

```javascript
foam.CLASS({
  name: 'CSVParser',
  extends: 'foam.parse.Grammar',

  properties: [
    'maxPos',
    'lastParser',
    'inputStr'
  ],

  methods: [
    function grammar(seq, sym, alt, repeat, plus, not, anyChar, eof, literal) {
      return {
        START: seq(sym('rows'), eof()),

        rows: repeat(sym('row'), sym('newline')),

        row: repeat(sym('field'), literal(',')),

        field: alt(
          sym('quotedField'),
          sym('unquotedField')
        ),

        quotedField: seq('"', sym('quotedContent'), '"'),

        quotedContent: repeat(alt(
          literal('""', '"'),  // Escaped quote
          not('"', anyChar())
        )),

        unquotedField: repeat(not(alt(',', '\n', '\r', eof()), anyChar())),

        newline: alt('\r\n', '\n', '\r')
      };
    },

    function parseCSV(str) {
      var self = this;
      self.inputStr = str;
      self.maxPos = 0;
      self.lastParser = null;

      var trackingApply = function(p, grammar) {
        if ( this.pos > self.maxPos ) {
          self.maxPos = this.pos;
          self.lastParser = p;
        }
        return p.parse(this, grammar);
      };

      var ps = foam.parse.StringPStream.create({
        str: str,
        apply: trackingApply
      });

      var result = this.parse(ps);

      if ( ! result ) {
        return this.buildErrorReport();
      }

      return { success: true, data: result.value };
    },

    function buildErrorReport() {
      var line = 1;
      var col = 1;

      // Calculate line and column
      for ( var i = 0; i < this.maxPos; i++ ) {
        if ( this.inputStr[i] === '\n' ) {
          line++;
          col = 1;
        } else {
          col++;
        }
      }

      // Get context around error
      var start = Math.max(0, this.maxPos - 20);
      var end = Math.min(this.inputStr.length, this.maxPos + 20);
      var context = this.inputStr.substring(start, end);
      var pointer = ' '.repeat(this.maxPos - start) + '^';

      return {
        success: false,
        error: {
          message: 'CSV parse error',
          line: line,
          column: col,
          position: this.maxPos,
          expected: this.lastParser ? this.lastParser.toString() : 'unknown',
          context: context,
          pointer: pointer
        }
      };
    }
  ]
});

// Usage:
var parser = CSVParser.create();
var result = parser.parseCSV('name,age\nJohn,30\nJane,"bad quote');

if ( ! result.success ) {
  console.log('Error at line', result.error.line, 'column', result.error.column);
  console.log('Context:', result.error.context);
  console.log('        ', result.error.pointer);
  console.log('Expected:', result.error.expected);
}
```

### Example 3: Using Apply for Debugging

```javascript
foam.CLASS({
  name: 'DebugGrammar',
  extends: 'foam.parse.Grammar',

  properties: [
    {
      name: 'debugLog',
      factory: function() { return []; }
    },
    {
      class: 'Int',
      name: 'depth',
      value: 0
    }
  ],

  methods: [
    function grammar(seq, sym, literal, plus, range) {
      return {
        START: sym('expression'),
        expression: seq(sym('term'), plus(seq('+', sym('term')))),
        term: sym('number'),
        number: plus(range('0', '9'))
      };
    },

    function parseWithDebug(str) {
      var self = this;
      self.debugLog = [];
      self.depth = 0;

      var debugApply = function(p, grammar) {
        var indent = '  '.repeat(self.depth);
        var parserName = p.toString().substring(0, 30);
        var inputPreview = this.str[0].substring(this.pos, this.pos + 10);

        self.debugLog.push(indent + '► ' + parserName + ' @ "' + inputPreview + '..."');
        self.depth++;

        var result = p.parse(this, grammar);

        self.depth--;
        if ( result ) {
          self.debugLog.push(indent + '✓ ' + parserName + ' = ' + JSON.stringify(result.value));
        } else {
          self.debugLog.push(indent + '✗ ' + parserName + ' FAILED');
        }

        return result;
      };

      var ps = foam.parse.StringPStream.create({
        str: str,
        apply: debugApply
      });

      var result = this.parse(ps);

      return {
        result: result ? result.value : null,
        log: self.debugLog
      };
    }
  ]
});

// Usage:
var parser = DebugGrammar.create();
var debug = parser.parseWithDebug('1+2+3');

console.log('Result:', debug.result);
console.log('Parse trace:');
debug.log.forEach(line => console.log(line));

/* Output:
Result: [["1"], [["+", ["2"]], ["+", ["3"]]]]
Parse trace:
► sym("expression") @ "1+2+3..."
  ► sym("term") @ "1+2+3..."
    ► sym("number") @ "1+2+3..."
      ► range("0", "9") @ "1+2+3..."
      ✓ range("0", "9") = "1"
    ✓ sym("number") = ["1"]
  ✓ sym("term") = ["1"]
  ...
*/
```

---

## Key Files Reference

| File | Description |
|------|-------------|
| `foam/parse/StringPStream.js` | PStream implementation with `apply` callback |
| `foam/parse/parse.js` | Core parser classes and Grammar |
| `foam/parse/auto/SmartView.js` | Example of using `apply` for suggestions |

### Important Line Numbers in `parse.js`

| Lines | Content |
|-------|---------|
| 74-122 | `Suggestion` class |
| 256-312 | `Literal` parser |
| 380-417 | `Alternate` parser |
| 420-455 | `Sequence` parser |
| 458-480 | `Suggest` parser decorator |
| 1001-1028 | `ParserWithAction` (wraps actions) |
| 1031-1078 | `Symbol` parser |
| 1344-1543 | `Grammar` class |
| 1411-1420 | Action registration in `init()` |
| 1452-1507 | `getLastError()` implementation |

### Important Line Numbers in `StringPStream.js`

| Lines | Content |
|-------|---------|
| 30-44 | `tail` getter (propagates `apply`) |
| 70-79 | `setValue()` (propagates `apply`) |
| 82-87 | `setString()` (default `apply` defined) |

---

## Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    CALLBACK SYSTEM SUMMARY                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. apply(parser, grammar)                                       │
│     └─► Intercepts EVERY parser invocation                       │
│     └─► Use for: debugging, error tracking, suggestions          │
│                                                                  │
│  2. <symbol>Action(value)                                        │
│     └─► Transforms result AFTER successful parse                 │
│     └─► Use for: type conversion, AST building                   │
│                                                                  │
│  3. Error Handling                                               │
│     └─► undefined = parse failed                                 │
│     └─► Track maxPos in apply() for error location               │
│     └─► Use getLastError() for detailed messages                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
