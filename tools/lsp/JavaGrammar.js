/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'JavaGrammar',
  extends: 'foam.parse.Grammar',

  documentation: `
    FOAM grammar for extracting method signatures, imports, and class
    declarations from .java files. Used by the LSP to discover Java-only
    methods that aren't declared as FOAM Method axioms.

    Entry points:
      START — full file scan, returns array of { type, name, sig, line, ... }

    The grammar uses a "skip-and-match" pattern: tries each pattern in
    order, falls through to anyChar() to skip one character. This makes
    it robust against unparseable code while still extracting structured
    information from valid signatures.
  `,

  methods: [
    function grammar(alt, anyChar, chars, literal, notChars, optional, range, repeat, seq, str, substring, sym, until, plus, msg) {
      return {
        START: repeat(alt(
          sym('lineComment'),
          sym('blockComment'),
          sym('annotation'),
          msg(sym('packageDecl'), { kind: 'package' }),
          msg(sym('importDecl'),  { kind: 'import' }),
          msg(sym('classDecl'),   { kind: 'classDecl' }),
          msg(sym('methodSig'),   { kind: 'methodSig' }),
          sym('skip')
        )),

        // Skip a single character (fallback for unmatched input)
        skip: anyChar(),

        // ===== Whitespace =====
        ws:    repeat(chars(' \t\n\r')),
        ws1:   plus(chars(' \t\n\r')),

        // ===== Comments =====
        lineComment:  seq('//', repeat(notChars('\n'))),
        blockComment: seq('/*', until('*/')),

        // ===== Annotations: @Override or @SuppressWarnings("foo") =====
        annotation: seq('@', sym('identifier'), optional(seq('(', until(')')))),

        // ===== package foo.bar; =====
        packageDecl: seq(
          literal('package'), sym('ws1'),
          str(sym('qualifiedName')),
          sym('ws'), ';'
        ),

        // ===== import foo.bar.Baz; =====
        importDecl: seq(
          literal('import'), sym('ws1'),
          optional(seq(literal('static'), sym('ws1'))),
          str(sym('qualifiedName')),
          sym('ws'), ';'
        ),

        // ===== Class/interface declaration =====
        classDecl: seq(
          repeat(seq(sym('modifier'), sym('ws1'))),
          alt(literal('class'), literal('interface'), literal('enum')),
          sym('ws1'),
          sym('identifier')
          // Skip rest of declaration — we just want the name
        ),

        // ===== Method signature =====
        // Pattern: [modifiers] returnType methodName(params) [throws X, Y]
        // Handles generic return types, array types, qualified names
        methodSig: seq(
          plus(seq(sym('modifier'), sym('ws1'))),  // at least one modifier
          sym('javaType'),                          // return type
          sym('ws1'),
          sym('identifier'),                        // method name
          sym('ws'),
          '(',
          substring(repeat(notChars(')'))),         // params (raw)
          ')',
          sym('ws'),
          optional(seq(literal('throws'), until(alt('{', ';'))))
        ),

        // ===== Java type: Type, List<X>, Map<K,V>, Type[], Type[][] =====
        javaType: seq(
          sym('typeName'),
          optional(sym('generics')),
          repeat(literal('[]'))
        ),

        typeName: seq(
          sym('identifier'),
          repeat(seq('.', sym('identifier')))
        ),

        // Generics with nested support: <X>, <X, Y>, <Map<K,V>>, <? extends X>
        generics: seq(
          '<',
          repeat(notChars('<>')),  // Simplified: doesn't fully handle nested generics
          optional(seq('<', repeat(notChars('<>')), '>')),
          repeat(notChars('<>')),
          '>'
        ),

        // ===== Modifiers =====
        modifier: alt(
          literal('public'),
          literal('private'),
          literal('protected'),
          literal('static'),
          literal('final'),
          literal('abstract'),
          literal('default'),
          literal('synchronized'),
          literal('native'),
          literal('volatile'),
          literal('transient'),
          literal('strictfp')
        ),

        // ===== Identifiers =====
        identifier: seq(
          alt(range('a', 'z'), range('A', 'Z'), '_', '$'),
          repeat(alt(range('a', 'z'), range('A', 'Z'), range('0', '9'), '_', '$'))
        ),

        qualifiedName: seq(
          sym('identifier'),
          repeat(seq('.', alt(sym('identifier'), '*')))
        )
      };
    }
  ]
});
