<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [FOAM Grammar-Based Parsers for JavaScript](#foam-grammar-based-parsers-for-javascript)
  - [Introduction](#introduction)
    - [Benefits of FOAM Grammar-Based Parsers](#benefits-of-foam-grammar-based-parsers)
    - [How FOAM Parsers Work](#how-foam-parsers-work)
  - [Simple Parsers](#simple-parsers)
    - [Setting Up](#setting-up)
    - [literal(str, opt_value)](#literalstr-opt_value)
    - [literalIC(str)](#literalicstr)
    - [anyChar()](#anychar)
    - [eof()](#eof)
    - [chars(str)](#charsstr)
    - [notChars(str)](#notcharsstr)
    - [range(start, end)](#rangestart-end)
  - [Parser Combinators](#parser-combinators)
    - [seq(...parsers)](#seqparsers)
    - [seq1(index, ...parsers)](#seq1index-parsers)
    - [seq0(...parsers)](#seq0parsers)
    - [alt(...parsers)](#altparsers)
    - [repeat(parser, opt_delim, opt_min, opt_max)](#repeatparser-opt_delim-opt_min-opt_max)
    - [repeat0(parser, opt_delim, opt_min, opt_max)](#repeat0parser-opt_delim-opt_min-opt_max)
    - [plus(parser, opt_delim)](#plusparser-opt_delim)
    - [optional(parser, opt_value)](#optionalparser-opt_value)
    - [not(parser, opt_parser)](#notparser-opt_parser)
    - [until(parser)](#untilparser)
    - [until0(parser)](#until0parser)
  - [Value Transformation Parsers](#value-transformation-parsers)
    - [str(parser)](#strparser)
    - [substring(parser)](#substringparser)
  - [Grammars](#grammars)
    - [Creating a Grammar](#creating-a-grammar)
    - [sym(name)](#symname)
    - [Example: Matched Parenthesis Parser](#example-matched-parenthesis-parser)
    - [Example: Phone Number Grammar](#example-phone-number-grammar)
  - [Semantic Actions](#semantic-actions)
    - [Defining Actions](#defining-actions)
    - [Example: Expression Interpreter](#example-expression-interpreter)
  - [Grammar Reuse](#grammar-reuse)
    - [Composition](#composition)
    - [Inheritance](#inheritance)
  - [Utility Methods](#utility-methods)
    - [match(input)](#matchinput)
    - [matchAll(input)](#matchallinput)
    - [getSymParser(symbolName)](#getsymparsersymbolname)
    - [stringPStream(str)](#stringpstreamstr)
  - [Auto-Complete Suggestions](#auto-complete-suggestions)
    - [Suggestion Class](#suggestion-class)
    - [Creating Suggestions with sug()](#creating-suggestions-with-sug)
    - [Suggestion Categories](#suggestion-categories)
    - [Example: Query Parser with Suggestions](#example-query-parser-with-suggestions)
    - [Custom Suggester Views](#custom-suggester-views)
    - [SmartView - The Suggestion UI](#smartview---the-suggestion-ui)
    - [How Suggestion Collection Works](#how-suggestion-collection-works)
    - [Building Dynamic Property Suggestions](#building-dynamic-property-suggestions)
    - [Nested Property Suggestions](#nested-property-suggestions)
  - [Best Practices](#best-practices)
  - [Complete Example: Email Address Parser](#complete-example-email-address-parser)
  - [Live Examples](#live-examples)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# FOAM Grammar-Based Parsers for JavaScript

## Introduction

FOAM includes a powerful parser library for JavaScript that uses **parser combinators** - simple parsers that can be combined to form larger, more complex parsers. This approach offers several key benefits over traditional parsing techniques like regular expressions:

### Benefits of FOAM Grammar-Based Parsers

1. **More Powerful Than Regular Expressions**: Can handle recursive patterns, nested structures, and context-sensitive grammars that regular expressions cannot parse.

2. **Composable and Modular**: Build complex parsers from simple, reusable building blocks - similar to how complex UIs are built from simple components like buttons and text fields.

3. **Readable and Maintainable**: Parser definitions are more explicit and easier to understand than cryptic regex patterns, especially for complex parsing tasks.

4. **Object-Oriented**: FOAM grammars leverage OO principles like inheritance and composition, enabling code reuse and specialization.

5. **Semantic Actions**: Easily transform parsed input into useful data structures (ASTs, computed values, etc.) rather than just matching patterns.

6. **Versatile Applications**:
   - Extracting data from files
   - Understanding network requests
   - Validating and reformatting user input
   - Creating Domain-Specific Languages (DSLs)
   - Building source code linters, refactoring tools, and syntax highlighters

### How FOAM Parsers Work

FOAM parsers operate on **PStreams** (Parser Streams), which are immutable objects with this interface:

- `pos` - Current character position in the input
- `head` - First character at current position
- `tail` - PStream for the next position
- `value` - Result value associated with this PStream
- `setValue(value)` - Creates new PStream at same position with new value

A Parser has a single method:
```javascript
PStream parse(PStream stream);
```

It returns either a PStream advanced past consumed input (with the parsed value in `.value`), or `undefined` if parsing failed.

---

## Simple Parsers

Simple parsers parse individual characters or literal strings without combining other parsers.

### Setting Up

First, create a singleton instance for accessing the parser library:

```javascript
var P = foam.parse.Parsers.create();
```

### literal(str, opt_value)

Parses an exact string match.

```javascript
var ps = foam.parse.StringPStream.create({str: 'abcdef'});
var parser = P.literal('abc');
ps = parser.parse(ps);
// ps.value = 'abc', ps.pos = 3
```

**Optional value parameter**: Return a different value on successful parse:
```javascript
var boolParser = P.alt(
  P.literal('true', true), 
  P.literal('false', false)
);
// Returns actual boolean values instead of strings
```

### literalIC(str)

Case-insensitive literal parser.

```javascript
var parser = P.literalIC('abc');
// Matches: 'abc', 'ABC', 'Abc', 'aBc', etc.
```

### anyChar()

Parses any single character.

```javascript
var parser = P.anyChar();
// Matches any character except EOF
```

### eof()

Matches end-of-file/end-of-input.

```javascript
var parser = P.eof();
// Only succeeds at end of input
```

### chars(str)

Parses any single character contained in the provided string.

```javascript
var parser = P.chars('abc');
// Matches 'a', 'b', or 'c'
```

### notChars(str)

Parses any single character NOT in the provided string (but not EOF).

```javascript
var parser = P.notChars('abc');
// Matches any character except 'a', 'b', 'c', or EOF
```

### range(start, end)

Parses any character within a range.

```javascript
var digitParser = P.range('0', '9');
var letterParser = P.range('a', 'z');
// digitParser matches '0' through '9'
// letterParser matches 'a' through 'z'
```

---

## Parser Combinators

Combinators compose simple parsers into complex ones.

### seq(...parsers)

Sequential parser - all sub-parsers must succeed in order. Returns array of parsed values.

```javascript
var parser = P.seq('a', 'b', 'c');
// Input 'abc' → ['a', 'b', 'c']

var parser = P.seq(P.range('a','z'), P.range('0','9'));
// Input 'r2' → ['r', '2']
```

**Shortcut**: String arguments automatically convert to `literal()` parsers.

### seq1(index, ...parsers)

Like `seq()` but returns only the value at specified index instead of an array.

```javascript
var quote = P.literal('"');
var stringBody = P.str(P.repeat(P.not(quote, P.anyChar())));
var parser = P.seq1(1, quote, stringBody, quote);
// Input '"hello"' → 'hello' (ignores quotes, returns only stringBody)
```

### seq0(...parsers)

Like `seq()` but returns no value - optimized for performance when you don't need results.

```javascript
var comment = P.seq0('/*', P.until0('*/'));
// Parses C-style comments efficiently without capturing content
```

### alt(...parsers)

Alternative parser - succeeds if any sub-parser succeeds. Returns first successful match.

```javascript
var parser = P.alt('A', 'B', 'C');
// Input 'B' → 'B'
```

### repeat(parser, opt_delim, opt_min, opt_max)

Repeats parser zero or more times. Returns array of values.

```javascript
var parser = P.str(P.repeat(P.range('0','9')));
// Input '123' → '123'
// Input '' → '' (zero matches is valid)
```

**With delimiter**: Parse values separated by delimiter (delimiter not included in result):
```javascript
var parser = P.str(P.repeat(P.range('a','z'), ','));
// Input 'a,b,c' → 'abc'
```

**With min/max repetitions**:
```javascript
var parser = P.repeat(P.range('a','z'), undefined, 5, 10);
// Requires at least 5 matches, continues up to 10
```

### repeat0(parser, opt_delim, opt_min, opt_max)

Like `repeat()` but returns no value - optimized for performance.

```javascript
const whitespace = P.repeat0(P.chars(' \t\n'), null, 1);
// Efficiently skips whitespace without capturing it
```

### plus(parser, opt_delim)

Repeats parser one or more times (fails on zero matches).

```javascript
var parser = P.str(P.plus(P.range('0','9')));
// Input '123' → '123'
// Input '' → undefined (fails)
```

### optional(parser, opt_value)

Parser that always succeeds - returns parsed value or continues from same position.

```javascript
var parser = P.seq(P.optional('header'), 'body');
// Input 'headerbody' → ['header', 'body']
// Input 'body' → [null, 'body']
```

**With default value**:
```javascript
var parser = P.optional(P.literal('-'), '-');
// Returns '-' even if not present in input
```

### not(parser, opt_parser)

Succeeds only if delegate parser fails.

```javascript
var quote = P.literal('"');
var stringBody = P.str(P.repeat(P.not(quote, P.anyChar())));
// Parses everything except quotes
```

### until(parser)

Parses input until the specified parser matches.

```javascript
var parser = P.until(P.literal('"'));
// Parses everything up to (but not including) a quote
```

### until0(parser)

Like `until()` but returns no value - optimized for performance.

```javascript
var comment = P.seq0('/*', P.until0('*/'));
// Efficiently skips comment content
```

### cut(parser)

Memory optimization parser that **destroys the input PStream after a successful parse**. This allows the JavaScript garbage collector to reclaim memory, enabling parsing of very large files that would otherwise cause heap exhaustion.

```javascript
var parser = P.cut(P.seq('a', 'b', 'c'));
// After successful parse, input PStream memory is released
```

**Why cut() is needed:**

FOAM's PStream is immutable - each `tail` operation creates a new PStream object. For large files (millions of characters), this creates millions of intermediate objects that can exhaust heap memory. Without `cut()`, a 60MB file might require 7+ GB of heap memory (116x the file size). With `cut()`, the same file needs only ~400MB (6x the file size).

**Memory usage comparison:**

| Approach | Memory Ratio | 60MB File Needs |
|----------|--------------|-----------------|
| Without cut | ~116x | 7+ GB |
| With cut | ~6x | ~400 MB |

**Important usage patterns:**

`cut()` must be used carefully because it destroys the input PStream. There are two valid approaches for collecting results when using `cut()`:

**Approach 1: Using `repeat` with actions that return values**

Actions return values directly, and `repeat()` collects them into an array:

```javascript
foam.CLASS({
  name: 'LargeFileParser',
  extends: 'foam.parse.Grammar',

  methods: [
    function grammar(alt, cut, eof, not, repeat, seq, seq0, sym) {
      return {
        // repeat() collects values returned by actions
        START: repeat(not(eof(), sym('line'))),

        // cut() wraps the entire line alternatives
        line: cut(alt(
          sym('header'),
          sym('dataLine'),
          sym('ignored')
        )),

        // Each rule must consume its own terminator (newline)
        header: seq0(sym('headerContent'), sym('nl')),
        ignored: seq0(sym('ignoredContent'), sym('nl')),
        dataLine: seq(sym('field1'), ',', sym('field2'), sym('nl')),

        nl: alt('\r\n', '\n', '\r')
      };
    },

    // Action returns the record - repeat() collects these
    function dataLineAction(v) {
      return {
        field1: v[0],
        field2: v[2]
      };
    },

    // Header and ignored lines return null (filtered out or kept as null)
    function headerAction(v) { return null; },
    function ignoredAction(v) { return null; }
  ]
});
```

**Approach 2: Using `repeat0` with external collection**

When you don't need `repeat()` to collect values, use `repeat0()` and push to an external array:

```javascript
foam.CLASS({
  name: 'LargeFileParser',
  extends: 'foam.parse.Grammar',

  properties: [
    {
      name: 'records_',
      factory: function() { return []; }
    }
  ],

  methods: [
    function grammar(alt, cut, eof, not, repeat0, seq, seq0, sym) {
      return {
        // repeat0() doesn't collect values
        START: repeat0(not(eof(), sym('line'))),

        line: cut(alt(
          sym('header'),
          sym('dataLine'),
          sym('ignored')
        )),

        header: seq0(sym('headerContent'), sym('nl')),
        ignored: seq0(sym('ignoredContent'), sym('nl')),
        dataLine: seq(sym('field1'), ',', sym('field2'), sym('nl')),

        nl: alt('\r\n', '\n', '\r')
      };
    },

    // Action pushes to external array
    function dataLineAction(v) {
      this.records_.push({
        field1: v[0],
        field2: v[2]
      });
      return null;
    },

    function STARTAction(v) {
      return this.records_;
    },

    function parseString(str) {
      this.records_ = []; // Reset for fresh parse
      this.SUPER(str);
      return this.records_;
    }
  ]
});
```

**Key rules for using cut():**

1. **Wrap the main `alt` with `cut()`** - not individual rules inside
2. **Each rule must consume its own terminator** - include newline in each line rule
3. **Choose `repeat` vs `repeat0` based on your needs** - use `repeat()` to collect action return values, use `repeat0()` when you don't need results collected

**When to use cut():**

- Parsing files larger than 10MB
- Processing files with hundreds of thousands of lines
- When you encounter "JavaScript heap out of memory" errors
- When memory usage is critical

**When NOT to use cut():**

- Small files (<10MB) - overhead not worth it
- When you need backtracking after a match
- Simple parsers that don't process large amounts of data

---

## Value Transformation Parsers

These parsers modify how values are returned.

### str(parser)

Converts array results into concatenated strings.

```javascript
var parser = P.seq(P.range('a','z'), P.range('0','9'));
// Without str: ['r', '2']

var parser = P.str(P.seq(P.range('a','z'), P.range('0','9')));
// With str: 'r2'
```

### substring(parser)

Returns the original input substring that was parsed (ignoring transformed values).

```javascript
var word = P.plus(P.range('a','z'));
var sentence = P.repeat(word, P.plus(' '));

var parser = P.substring(sentence);
// Input 'abc   def   xyz' → 'abc   def   xyz'
// Preserves whitespace that would be lost with repeat()
```

---

## Grammars

For complex or recursive parsers, use **Grammars** - collections of named, mutually recursive parsers.

### Creating a Grammar

```javascript
foam.CLASS({
  name: 'MyGrammar',
  extends: 'foam.parse.Grammar',
  
  methods: [
    function grammar(/* parser constructors as params */) {
      return {
        START: /* your top-level parser */,
        rule1: /* named parser */,
        rule2: /* named parser */
      };
    }
  ]
});
```

### sym(name)

References a named parser within a grammar.

```javascript
function grammar(str, sym, seq, seq1, eof) {
  return {
    START: seq1(0, sym('parens'), eof()),
    
    // Recursive reference to itself
    parens: str(repeat(str(seq('(', sym('parens'), ')'))))
  };
}
```

### Example: Matched Parenthesis Parser

```javascript
foam.CLASS({
  name: 'MatchedParensParser',
  extends: 'foam.parse.Grammar',

  methods: [
    function grammar(str, sym, eof, repeat, seq, seq1) {
      return {
        START: seq1(0, sym('parens'), eof()),

        parens: str(repeat(
          str(seq('(', sym('parens'), ')'))
        ))
      };
    }
  ]
});

var p = MatchedParensParser.create();
// Matches: '', '()', '(())', '()()', '((())()(()))'
// Fails: ')(', '(()', '())'
```

### Example: Phone Number Grammar

```javascript
foam.CLASS({
  name: 'PhoneNumberParser',
  extends: 'foam.parse.Grammar',

  methods: [
    function grammar(alt, sym, seq1, seq, str, literal, optional, plus, range) {
      return {
        START: str(seq(
          optional(sym('countryCode')),
          alt(
            str(seq(sym('areaCode'), optional(' ', ' '), sym('simple'))),
            sym('simple'))
        )),

        simple: str(seq(sym('prefix'), optional(sym('separator'), '-'), sym('line'))),

        digit: range('0', '9'),

        countryCode: seq1(1, optional('+'), literal('1', '1 '), optional(' ')),

        areaCode: str(seq(
          optional('(', '('),
          sym('digit'), sym('digit'), sym('digit'),
          optional(')', ')'))),

        prefix: str(seq(sym('digit'), sym('digit'), sym('digit'))),

        separator: alt('-', ' '),

        line: str(seq(sym('digit'), sym('digit'), sym('digit'), sym('digit')))
      };
    }
  ]
});

var p = PhoneNumberParser.create();
// Matches: '5551234', '555-1234', '(555) 555-1234', '+1 (555) 555-1234'
```

---

## Semantic Actions

Transform parsed values by defining action methods in your grammar.

### Defining Actions

Create methods named `<symbolName>Action`:

```javascript
foam.CLASS({
  name: 'VersionParser',
  extends: 'foam.parse.Grammar',

  methods: [
    function grammar(alt, not, sym, seq, str, optional, plus, repeat, range, anyChar) {
      return {
        START: repeat(sym('component'), optional(sym('separator'))),
        component: alt(sym('number'), sym('string')),
        digit: range('0', '9'),
        number: str(plus(sym('digit'))),
        string: str(plus(not(alt(sym('digit'), sym('separator')), anyChar()))),
        separator: alt('.', '-')
      };
    },

    // Semantic action for 'number' symbol
    function numberAction(v) { 
      return parseInt(v); // Convert string to integer
    }
  ]
});

var p = VersionParser.create();
// Input '3.14159-26b' → [3, '.', 14159, '-', '26', 'b']
```

### Example: Expression Interpreter

```javascript
foam.CLASS({
  name: 'ExpressionInterpreter',
  extends: 'foam.parse.Grammar',

  properties: ['x', 'y', 'z'],

  methods: [
    function grammar(plus, sym, alt, opt, seq, seq1, lit, range, eof) {
      return {
        START: seq1(0, sym('expr'), eof()),
        expr: seq(sym('expr1'), opt(seq(alt('+', '-'), sym('expr')))),
        expr1: seq(sym('expr2'), opt(seq(alt('*', '/'), sym('expr1')))),
        expr2: seq(sym('expr3'), opt(seq1(1, '^', sym('expr2')))),
        expr3: alt(sym('fun'), sym('variable'), sym('number'), sym('group')),
        variable: alt('x', 'y', 'z'),
        fun: seq(alt('sqrt', 'log2'), '(', sym('expr'), ')'),
        group: seq1(1, '(', sym('expr'), ')'),
        number: /* number parser */
      };
    },
    
    function exprAction(v) {
      if (v[1] === null) return v[0];
      if (v[1][0] == '+') return v[0] + v[1][1];
      return v[0] - v[1][1];
    },
    
    function expr1Action(v) {
      if (v[1] === null) return v[0];
      if (v[1][0] == '*') return v[0] * v[1][1];
      return v[0] / v[1][1];
    },
    
    function expr2Action(v) {
      if (v[1] === null) return v[0];
      return Math.pow(v[0], v[1]);
    },
    
    function funAction(v) {
      return v[0] == 'sqrt' ? Math.sqrt(v[2]) : Math.log2(v[2]);
    },
    
    function variableAction(v) { 
      return this[v]; 
    }
  ]
});

const interp = ExpressionInterpreter.create({x: 1, y: 10, z: 100});
// Input '1*(x+y*sqrt(9))*-23/4' → -178.25
```

---

## Grammar Reuse

FOAM grammars support OO principles for code reuse.

### Composition

Embed grammars within other grammars:

```javascript
foam.CLASS({
  name: 'ExpressionParser',
  extends: 'foam.parse.Grammar',
  requires: ['NumberParser'],

  methods: [
    function grammar(sym) {
      return {
        START: sym('expr'),
        // ... other rules ...
        number: this.NumberParser.create() // Compose NumberParser
      };
    }
  ]
});
```

### Inheritance

Extend grammars to modify or add behavior:

```javascript
foam.CLASS({
  name: 'BinaryInterpreter',
  extends: 'ExpressionInterpreter',
  requires: ['BinaryNumberParser as NumberParser']
});

const interp = BinaryInterpreter.create();
// Now interprets binary numbers: '101+111+1' → 15
```

---

## Utility Methods

### match(input)

Find first occurrence in input text:

```javascript
var p = PhoneNumberParser.create();
var input = 'Call me at (555) 123-4556 or email...';
var result = p.match(input);
// Returns '(555) 123-4556'
```

### matchAll(input)

Find all occurrences in input text:

```javascript
var p = PhoneNumberParser.create();
var input = 'Phone: (555) 123-4556, Fax: 555-1234';
var results = p.matchAll(input);
// Returns ['(555) 123-4556', '555-1234']
```

### getSymParser(symbolName)

Access individual grammar rules for testing:

```javascript
var p = PhoneNumberParser.create();
var areaCodeParser = p.getSymParser('areaCode');
// Test just the area code rule
```

### stringPStream(str)

Convenience method to create PStream from string:

```javascript
var ps = P.stringPStream('abc');
// Equivalent to: foam.parse.StringPStream.create({str: 'abc'})
```

---

## Auto-Complete Suggestions

FOAM parsers support auto-complete suggestions through the `Suggest` parser decorator and `SmartView` UI component. This enables intelligent autocomplete for search bars, query builders, and other text inputs.

### Suggestion Class

The `foam.parse.Suggestion` class represents a single suggestion:

```javascript
foam.CLASS({
  package: 'foam.parse',
  name: 'Suggestion',
  properties: [
    { class: 'String', name: 'text' },       // Text to insert on selection
    { class: 'String', name: 'label' },      // Display label (defaults to text)
    { class: 'String', name: 'tooltip' },    // Hint text (doesn't insert anything)
    { class: 'String', name: 'category' },   // For styling: property, operator, value, format
    { name: 'view', class: 'foam.u2.ViewSpec' }, // Custom suggester view
    { class: 'Boolean', name: 'prependSpaceOnSelect', value: true }
  ]
});
```

### Creating Suggestions with sug()

Use the `sug(parser, suggestionSpec)` combinator to attach suggestions to parsers:

```javascript
var P = foam.parse.Parsers.create();

// Basic text suggestion
sug(literal('AND'), {text: 'AND', category: 'operator'})

// Suggestion with different label and text
sug(literal('>='), {text: '>=', label: 'Greater or Equal', category: 'operator'})

// Tooltip-only suggestion (shows hint, doesn't auto-complete)
sug(seq(sym('digits'), '-', sym('digits'), '-', sym('digits')),
    {tooltip: 'YYYY/MM/DD', category: 'format'})

// Suggestion with custom view
sug(nop(), {view: 'foam.parse.auto.DateSuggester'})
```

### Suggestion Categories

Categories control styling in the suggestion dropdown:

| Category | Color | Use Case |
|----------|-------|----------|
| `property` | Green | Field/property names |
| `operator` | Orange | Operators like AND, OR, =, > |
| `value` | Blue | Enumeration values, keywords |
| `format` | Gray | Format hints (tooltips only) |

### Example: Query Parser with Suggestions

```javascript
foam.CLASS({
  name: 'SearchQueryParser',
  extends: 'foam.parse.Grammar',

  methods: [
    function grammar(alt, sym, seq, seq1, literal, literalIC, sug) {
      // Helper for operators with suggestions
      let operator = (str) => alt(
        seq1(2, ' ', sym('ws'), sug(literalIC(str), {text: str, category: 'operator'})),
        literalIC(str)
      );

      return {
        START: sym('query'),

        query: sym('or'),

        // OR with suggestion
        or: repeat(sym('and'),
          seq(' ', seq1(1, sym('ws'),
            sug(alt(literalIC('OR'), literal('|')), {text: 'OR', category: 'operator'})
          ))
        ),

        // AND with suggestion
        and: repeat(sym('expr'),
          seq(' ', seq1(1, sym('ws'),
            sug(alt(literalIC('AND'), literal('&')), {text: 'AND', category: 'operator'})
          ))
        ),

        // Property with suggestion
        prop: seq1(1, sym('ws'),
          sug(literal('status'), {text: 'status', label: 'Status', category: 'property'})
        ),

        // Enum values with suggestions
        statusValue: alt(
          sug(literal('ACTIVE'), {text: 'ACTIVE', category: 'value'}),
          sug(literal('INACTIVE'), {text: 'INACTIVE', category: 'value'})
        ),

        ws: repeat0(' ')
      };
    }
  ]
});
```

### Custom Suggester Views

For complex input like dates or colors, create custom suggester views:

```javascript
foam.CLASS({
  package: 'foam.parse.auto',
  name: 'DateSuggester',
  extends: 'foam.u2.View',

  properties: [
    'suggestText',  // Function to call when suggestion is selected
    { class: 'Date', name: 'date', onKey: true }
  ],

  methods: [
    function render() {
      this.startContext({data: this}).add(this.DATE);
      this.date$.sub(() => {
        // Call suggestText with the formatted date
        this.suggestText(this.date.toISOString().substring(0,10) + ' ');
      });
    }
  ]
});
```

Use in grammar:
```javascript
date: seq1(1, sym('ws'),
  alt(
    sug(nop(), {view: 'foam.parse.auto.DateSuggester'}), // Show date picker
    sym('literal date'),
    sym('relative date')
  )
)
```

### SmartView - The Suggestion UI

`foam.parse.auto.SmartView` is a TextField that provides autocomplete:

```javascript
foam.CLASS({
  name: 'SearchBar',
  extends: 'foam.u2.View',

  requires: ['foam.parse.auto.SmartView'],

  methods: [
    function render() {
      this.tag(this.SmartView, {
        parser: MyQueryParser.create({of: MyModel}),
        data$: this.query$
      });
    }
  ]
});
```

### How Suggestion Collection Works

1. SmartView parses input with a custom `apply` callback
2. Tracks the furthest parse position (`maxPos`)
3. Collects suggestions only at the furthest position
4. As user types, filters suggestions to those matching partial input
5. Tab key auto-completes when single match exists

```javascript
// Internal mechanism in SmartView.apply:
return function(p, grammar) {
  // Reset suggestions when reaching new furthest position
  if ( this.pos > self.maxPos ) {
    self.suggestions = {};
    self.maxPos = this.pos;
  }

  // Collect suggestion at furthest position
  if ( this.pos == self.maxPos && p.suggest ) {
    let s = p.suggest();
    if ( s ) self.suggestions[s.label || s.tooltip] = s;
  }

  return p.parse(this, grammar);
}
```

### Building Dynamic Property Suggestions

For query parsers that work with FOAM models, dynamically generate property suggestions:

```javascript
// In propertiesGrammar_
let props = cls.getAxiomsByClass(foam.lang.Property);
let propPredicates = [];

for ( let prop of props ) {
  if ( ! prop.searchable ) continue;

  // Create parser with suggestion for each property
  let propParser = seq1(1, sym('ws'),
    sug(literal(prop.name, prop), {
      text: prop.name,
      label: prop.label,
      category: 'property'
    })
  );

  // Add appropriate comparison based on property type
  if ( foam.lang.String.isInstance(prop) ) {
    propPredicates.push(seq(propParser, sym('compareString')));
  } else if ( foam.lang.Int.isInstance(prop) ) {
    propPredicates.push(seq(propParser, sym('compareNumber')));
  }
  // ... handle other types
}

return { propPredicates: alt.apply(null, propPredicates) };
```

### Nested Property Suggestions

For FObjectProperty types, support dot notation:

```javascript
let innerProperty = (prop, innerProp) => {
  let expr = foam.mlang.expr.Dot.create({arg1: prop, arg2: innerProp});
  return seq1(2,
    sym('ws'),
    // First part: "address."
    sug(seq1(0, literal(prop.name), '.'), {
      text: prop.name + '.',
      label: prop.label,
      category: 'property'
    }),
    // Second part: "city" (no space before)
    sug(literal(innerProp.name, expr), {
      text: innerProp.name,
      label: innerProp.label,
      category: 'property',
      prependSpaceOnSelect: false
    })
  );
};
```

---

## Best Practices

1. **Start Simple**: Test individual parsers before combining them
2. **Use Grammars for Complexity**: Move to Grammar classes when parsers become recursive or large
3. **Test Each Symbol**: Use `getSymParser()` to test grammar rules individually
4. **Choose Appropriate Optimizations**: Use `repeat0()`, `seq0()`, `until0()` when you don't need return values
5. **Leverage Composition and Inheritance**: Reuse parser components across projects
6. **Add Semantic Actions**: Transform parsed data into useful structures early
7. **Use `substring()` to Preserve Input**: When you need the exact input text rather than transformed values
8. **Use Suggestions for UX**: Add `sug()` wrappers to improve discoverability in search/query interfaces
9. **Categorize Suggestions**: Use consistent categories (property, operator, value, format) for styling
10. **Custom Suggesters for Complex Input**: Create custom views for dates, colors, and other complex types

---

## Complete Example: Email Address Parser

```javascript
foam.CLASS({
  name: 'EmailAddressParser',
  extends: 'foam.parse.Grammar',

  methods: [
    function grammar(alt, sym, seq, str, repeat, notChars) {
      return {
        START: sym('address'),

        addressList: repeat(sym('address'), seq(',', repeat(' '))),

        address: alt(sym('labelledAddress'), sym('simpleAddress')),

        labelledAddress: seq(
          repeat(notChars('<,')), 
          '<', 
          sym('simpleAddress'), 
          '>'
        ),

        simpleAddress: seq(
          repeat(notChars('@')), 
          '@', 
          repeat(notChars('\r>,'))
        )
      };
    },

    function labelledAddressAction(v) { 
      return v[0].join('') + v[1] + v[2] + v[3]; 
    },

    function simpleAddressAction(v) { 
      return v[0].join('') + v[1] + v[2].join(''); 
    }
  ]
});

var p = EmailAddressParser.create();
// Parses: 'john@email.com'
// Parses: 'John Doe <john@email.com>'
// Parses: 'john@email.com, jane@email.com' (using 'addressList')
```

---

With FOAM's grammar-based parsers, you can tackle parsing challenges that would be impossible or unwieldy with regular expressions, while maintaining readable, testable, and reusable code.

---

## Live Examples

FOAM comes with the demo examples that you can run in browsers and test interactively. 

> [!IMPORTANT]
> To explore FOAM parser examples make sure that you have a running FOAM application. For more info on how to build FOAM go to [FOAM Installation ReadMe][FOAM].


Once you have a running FOAM application go to [FOAM Parsers Demo Interactive Page][Live-Examples] in your browser. All code blocks are editable and will execute upon focus change.


<!-- List all links here -->
[FOAM]: https://github.com/kgrgreer/foam3/blob/development/INSTALL.md
[Live-Examples]: http://localhost:8080/foam3/src/foam/demos/examples/index.html?modules=parsers