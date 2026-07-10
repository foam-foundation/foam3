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
        // Top-level patterns. Rule order is significant — first match wins.
        // The body-level patterns (qualifiedCall, castExpr, newExpr,
        // localDecl) fire inside method bodies AND in field initializers
        // because START is a flat scan. `skip` is the catch-all so unmatched
        // input never blocks parsing.
        START: repeat(alt(
          msg(sym('stringLit'),    { kind: 'stringLit' }),
          msg(sym('charLit'),      { kind: 'charLit' }),
          msg(sym('lineComment'),  { kind: 'lineComment' }),
          msg(sym('blockComment'), { kind: 'blockComment' }),
          sym('annotation'),
          msg(sym('packageDecl'), { kind: 'package' }),
          msg(sym('importDecl'),  { kind: 'import' }),
          msg(sym('classDecl'),   { kind: 'classDecl' }),
          msg(sym('methodSig'),   { kind: 'methodSig' }),
          // === Body-level patterns ===
          msg(sym('castExpr'),       { kind: 'castExpr' }),
          msg(sym('newExpr'),        { kind: 'newExpr' }),
          msg(sym('qualifiedCall'),  { kind: 'qualifiedCall' }),
          msg(sym('varDecl'),        { kind: 'varDecl' }),
          msg(sym('localDecl'),      { kind: 'localDecl' }),
          msg(sym('plainIdent'),     { kind: 'plainIdent' }),
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

        // ===== String / char literals =====
        // Matched at the top of START so a // or /* inside a literal never
        // opens a comment, and literal interiors emit no body-level
        // captures (idents, calls, decls). Newline excluded — an
        // unterminated literal (mid-edit) fails here and falls through to
        // skip instead of swallowing the rest of the file.
        stringLit: seq('"', repeat(alt(seq('\\', anyChar()), notChars('"\\\n'))), '"'),
        charLit:   seq("'", repeat(alt(seq('\\', anyChar()), notChars("'\\\n"))), "'"),

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
        ),

        // ===== Body-level patterns (method bodies, field initializers) =====
        // Emit position-tagged identifiers for go-to-def / hover / semantic
        // tokens. These rules don't try to fully parse Java — they just
        // surface the offsets of identifiers that benefit from navigation.
        // Each rule consumes its match exactly; mismatched input falls
        // through to the broader patterns above and finally to `skip`.

        // `<recv>.<method>(args` — method call on a receiver. Receiver may
        // be a Type (UpperCamelCase, e.g. `Loggers.logger(...)`) or a
        // variable (`disputeCase.getId()`). Only the LAST segment is
        // tagged; chains like `a.b.c.method()` resolve segment-by-segment
        // as the parser sweeps START's alt list. Sub-positions are
        // recovered by the parser from the matched span — using inner
        // msg() decorators here would emit false positives on failed
        // outer attempts (apply-callback isn't transactional).
        qualifiedCall: seq(
          sym('identifier'),
          '.',
          sym('identifier'),
          sym('ws'),
          '('
        ),

        // `new <Type>(args)` — instance creation. Emit the type position.
        // upperTypeName so Java conventional capitalization protects
        // against `new x(...)` false positives.
        newExpr: seq(
          literal('new'),
          sym('ws1'),
          sym('upperTypeName'),
          optional(sym('generics')),
          sym('ws'),
          alt(literal('('), literal('['), literal('{'))
        ),

        // `(<Type>) expr` — cast target. upperTypeName eliminates the
        // common false positive `(x)` from `foo(x)` argument lists.
        // Double-paren forms `((<Type>) expr).method()` resolve naturally:
        // the outer `(` is consumed by `skip`, then the inner cast matches.
        castExpr: seq(
          literal('('),
          sym('ws'),
          sym('upperTypeName'),
          optional(sym('generics')),
          sym('ws'),
          literal(')')
        ),

        // `<Type> [<generics>] <name>` followed by `=` or `;` — local var
        // declaration. The TypeTracker uses this to resolve identifiers.
        // Restrict typeName to start with an uppercase letter so
        // statements like `disputeCase.getId();` (where `disputeCase` is a
        // lowercase identifier) don't accidentally match.
        localDecl: seq(
          sym('upperTypeName'),
          optional(sym('generics')),
          sym('ws1'),
          sym('identifier'),
          sym('ws'),
          alt(literal('='), literal(';'), literal(','))
        ),

        // `var <name> = <rhs>` — Java 10+ inferred-type declaration. The
        // RHS shape (new T(), (T) expr, T.staticMethod(), literal class,
        // method ref) determines the variable's type. Consume up to the
        // first non-whitespace token after `=` so JavaParser sees the
        // beginning of the RHS in the matched span.
        varDecl: seq(
          literal('var'),
          sym('ws1'),
          sym('identifier'),
          sym('ws'),
          literal('='),
          sym('ws'),
          // Capture enough of the RHS to extract a type. We grab up to a
          // statement terminator or end-of-line so `extractVarDecl_` can
          // pattern-match `new T(...)`, `(T) ...`, or `T.staticMethod(`.
          sym('varDeclRhs')
        ),

        // RHS of var-decl: scan forward until ; or newline, but limited
        // so we don't swallow whole method bodies.
        varDeclRhs: seq(
          repeat(notChars(';\n\r'), null, 1),
          optional(literal(';'))
        ),

        upperTypeName: seq(
          range('A', 'Z'),
          repeat(alt(range('a', 'z'), range('A', 'Z'), range('0', '9'),
            literal('_'), literal('$'))),
          repeat(seq('.', sym('identifier')))
        ),

        // Catch-all bare identifier. Emitted so dot-prefixed enum constants
        // like `Foo.BAR` get the trailing `BAR` tagged (after the
        // `qualifiedCall` arm declines because no `(` follows).
        plainIdent: seq(
          msg(sym('identifier'), { kind: 'identTok' })
        )
      };
    }
  ]
});
