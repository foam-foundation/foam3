/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lint',
  name: 'GrammarLint',

  documentation: `
    Checks built foam.parse grammars for mistakes that the parser only shows
    at run time, or never shows at all. It reads the parser objects a grammar
    is made of, so it needs no parser for grammar source text.

    Checks, per grammar:
      undefined-symbol  sym('x') where the grammar has no rule x. Parsing
                        throws an assertion when it reaches that sym().
      orphan-action     a method named xAction (or a grammars: axiom action x)
                        with no rule x. Grammar attaches actions by name, so
                        this action never runs and nothing says so.
      left-recursion    a rule that can reach itself before reading a
                        character, e.g. expr: seq(sym('expr'), '+', ...).
                        The parse recurses until the stack overflows.
      empty-repeat      an unbounded repeat whose item can match without
                        reading a character. Repeat has no progress check, so
                        the loop runs until maximum (2^53) iterations.
                        repeat() stops at the end of the input; repeat0()
                        does not, and treats its delimiter as optional, so
                        repeat0(alt('a', eof())) is reported too.
      unreachable       rules START cannot reach, one warning per grammar
                        (fine for an entry point used by name, e.g.
                        parseString(text, 'yymmdd'); dead code otherwise).
      duplicate-symbol  two rules with one name (possible with addSymbol or a
                        symbols array); the last one wins.
      no-start          rules but no START (warning: parseString() and
                        parse() without a name assert on START).

    A subclass that only adds actions (DateParser adds them to DateGrammar's
    rules) gets only the orphan-action check; its rules are checked once, on
    the class that defines them.

    Not checked:
      - Grammars created inside a method, e.g. this.Grammar.create({ symbols })
        in SimpleQueryParser or CSSParser. Only classes are found; check one
        of these from a test with lintGrammar(grammar).
      - Grammars built from data (a rule per record, per property) when that
        data is missing here. Building one that throws is reported as
        severity 'skip', not as an error.
      - Rules or alternatives added after the grammar is created, e.g. from
        a DAO. The grammar is checked as create() leaves it, and an empty
        alternative is never reported.
      - Anything under Parsers.cut(p): it returns a plain object that keeps p
        in a closure. A grammar using cut() skips the unreachable check and
        says so; a sym() under a cut() is not checked.
      - Java grammars (foam.lib.parse); this reads JS parser objects only.
      - A parser class an app defines is walked for sym() references, but
        the left-recursion and empty-repeat checks assume it always reads a
        character, so a loop through one is missed rather than misreported.
      - Line numbers: a finding names the file, class and rule.
  `,

  requires: [
    'foam.parse.lint.GrammarLintFinding'
  ],

  constants: [
    { name: 'START', value: 'START' }
  ],

  methods: [
    function lintClass(cls, opt_x) {
      /** Findings for the grammars one class defines; see lintClasses. */
      return this.lintClasses([ cls ], opt_x);
    },

    function lintClasses(classes, opt_x) {
      /**
       * Findings for every grammar the classes define: a class that extends
       * foam.parse.Grammar, plus each grammars: axiom a class declares
       * (inherited axioms belong to the class that declared them). A grammar
       * with no rules at all, like an abstract base, yields nothing.
       *
       * An action method counts as used when its rule exists in the class or
       * in any of its subclasses among these classes: a base grammar may hold
       * the action for a rule only some subclasses define.
       */
      var self     = this;
      var x        = opt_x || foam.__context__;
      var findings = [];
      var targets  = [];

      classes.forEach(function(cls) {
        var source = cls.model_ && cls.model_.source || '';

        if ( self.isGrammarClass_(cls) ) {
          targets.push({
            cls: cls, label: cls.id, source: source,
            build:       function() { return cls.create(null, x); },
            actions:     self.methodActionNames_(cls),
            actionsOnly: self.rulesOwner_(cls) !== cls
          });
        }

        cls.getOwnAxiomsByClass(foam.parse.GrammarAxiom).forEach(function(axiom) {
          targets.push({
            label: cls.id + '#' + axiom.name, source: source,
            build:   function() { return axiom.buildGrammar(x); },
            actions: axiom.actions.map(function(a) { return a.name; })
          });
        });
      });

      targets.forEach(function(t) {
        try {
          t.grammar = t.build();
        } catch (e) {
          findings.push(self.GrammarLintFinding.create({
            severity: 'skip', check: 'not-built', grammar: t.label, source: t.source,
            message: 'could not build without app data: ' + self.firstLine_(e)
          }));
        }
      });

      var built = targets.filter(function(t) { return t.grammar; });

      var names = function(g) { return ( g.symbols || [] ).map(function(s) { return s.name; }); };

      built.forEach(function(t) {
        var opts = { actions: t.actions, actionsOnly: t.actionsOnly };
        if ( t.cls ) {
          var below = {}, above = {};
          built.forEach(function(u) {
            if ( ! u.cls ) return;
            if ( t.cls.isSubClass(u.cls) ) names(u.grammar).forEach(function(n) { below[n] = true; });                   // t and its subclasses
            if ( u.cls !== t.cls && u.cls.isSubClass(t.cls) ) names(u.grammar).forEach(function(n) { above[n] = true; }); // t's base grammars
          });
          opts.actions   = t.actions.filter(function(n) { return ! below[n]; }); // a subclass rule uses a base action
          opts.inherited = above;
          opts.isBase    = ! self.hasRule_(t.grammar, self.START) && below[self.START];
        }
        self.lintGrammar(t.grammar, opts).forEach(function(f) {
          f.grammar = t.label;
          f.source  = t.source;
          findings.push(f);
        });
      });

      return findings;
    },

    function lintGrammar(grammar, opt_opts) {
      /**
       * Findings for one built grammar. opt_opts:
       *   actions:     names of actions declared for it (without the 'Action'
       *                suffix); any with no rule here is an orphan
       *   actionsOnly: run only the orphan-action check
       *   inherited:   { rule: true } for rules a base grammar defines; a
       *                subclass need not use them, so they are not unreachable
       *   isBase:      a subclass supplies START, so no-start is not reported
       */
      var opts    = opt_opts || {};
      var self    = this;
      var symbols = grammar.symbols || [];
      if ( ! symbols.length ) return [];

      var findings = [];
      var add = function(severity, check, symbol, message) {
        findings.push(self.GrammarLintFinding.create({
          severity: severity, check: check, symbol: symbol, message: message
        }));
      };

      var defined = {};
      symbols.forEach(function(s) {
        if ( defined[s.name] ) add('error', 'duplicate-symbol', s.name, 'rule ' + s.name + ' is defined twice; the last one wins');
        defined[s.name] = s.parser;
      });

      // undefined-symbol
      symbols.forEach(function(s) {
        var reported = {};
        self.walk_(s.parser, function(p) {
          if ( foam.parse.Symbol.isInstance(p) && ! defined.hasOwnProperty(p.name) && ! reported[p.name] ) {
            reported[p.name] = true;
            add('error', 'undefined-symbol', s.name, "sym('" + p.name + "') names a rule this grammar does not define");
          }
        });
      });

      // orphan-action
      ( opts.actions || [] ).forEach(function(name) {
        if ( ! defined.hasOwnProperty(name) ) {
          add('error', 'orphan-action', name, 'action for ' + name + ' never runs: the grammar has no rule ' + name);
        }
      });

      if ( opts.actionsOnly ) return findings;

      // no-start, unreachable
      if ( ! defined.hasOwnProperty(this.START) ) {
        if ( ! opts.isBase ) add('warning', 'no-start', '', 'no START rule; parseString() and parse() without a rule name assert');
      } else {
        var opaque = symbols.some(function(s) {
          var found = false;
          self.walk_(s.parser, function(p) { if ( ! p.cls_ ) found = true; });
          return found;
        });
        if ( opaque ) {
          add('skip', 'unreachable', '', 'not checked: a plain-object parser such as cut() hides the rules under it');
        } else {
          var reach     = this.reachable_(defined, this.START);
          var inherited = opts.inherited || {};
          var unused    = symbols.map(function(s) { return s.name; }).filter(function(n) { return ! reach[n] && ! inherited[n]; });
          if ( unused.length ) {
            add('warning', 'unreachable', '', 'START never reaches ' + unused.length + ' rule' + ( unused.length > 1 ? 's' : '' ) + ': ' + unused.join(', '));
          }
        }
      }

      var nullable = this.nullableRules_(symbols, defined);
      // repeat() stops at the end of the input by itself, so for its check
      // eof() counts as reading: seq(restOfLine, alt(nl, eof())) always reads
      // a character when there is one left. repeat0() has no end-of-input
      // stop, so its item is also checked as it behaves at the end.
      var nullableMid = this.nullableRules_(symbols, defined, 'mid');
      var nullableEnd = this.nullableRules_(symbols, defined, 'end');

      // left-recursion: one finding per group of rules that call each other
      // before reading a character.
      this.leftCycles_(symbols, defined, nullable).forEach(function(group) {
        add('error', 'left-recursion', group[0],
          ( group.length === 1 ? group[0] + ' calls itself' : group.join(', ') + ' call each other' ) +
          ' before reading a character, so the parse never ends');
      });

      // empty-repeat
      symbols.forEach(function(s) {
        self.walk_(s.parser, function(p) {
          if ( ! foam.parse.Repeat.isInstance(p) ) return;
          if ( p.maximum < Number.MAX_SAFE_INTEGER ) return;
          if ( foam.parse.Repeat0.isInstance(p) ) {
            // A delimiter that fails is skipped (ps.apply(delim) || ps), so it cannot stop the loop.
            if ( ! self.nullable_(p.p, nullableMid, new Map(), 'mid') &&
                 ! self.nullable_(p.p, nullableEnd, new Map(), 'end') ) return;
          } else {
            if ( ! self.nullable_(p.p, nullableMid, new Map(), 'mid') ) return;
            if ( p.delimiter && ! self.nullable_(p.delimiter, nullableMid, new Map(), 'mid') ) return;
          }
          add('error', 'empty-repeat', s.name, p.cls_.name.toLowerCase() + '() item can match without reading a character, so the loop never ends');
        });
      });

      return findings;
    },

    // ---- tree walking ----------------------------------------------------

    function childrenOf_(p) {
      /**
       * Parsers p delegates to, read from its ParserProperty / ParserArray
       * properties, so a combinator an app defines is walked too. A Symbol
       * has none here: its rule is reached by name.
       */
      if ( ! p || ! p.cls_ || foam.parse.Symbol.isInstance(p) || foam.parse.Grammar.isInstance(p) ) return [];
      var out = [];
      p.cls_.getAxiomsByClass(foam.parse.ParserProperty).forEach(function(prop) {
        var v = p[prop.name];
        if ( v ) out.push(v);
      });
      p.cls_.getAxiomsByClass(foam.parse.ParserArray).forEach(function(prop) {
        var v = p[prop.name];
        if ( Array.isArray(v) ) out = out.concat(v);
      });
      return out;
    },

    function walk_(p, fn, opt_seen) {
      /** Calls fn on p and every parser under it, once each. */
      var seen = opt_seen || new Set();
      if ( ! p || seen.has(p) ) return;
      seen.add(p);
      fn(p);
      var self = this;
      this.childrenOf_(p).forEach(function(c) { self.walk_(c, fn, seen); });
    },

    function reachable_(defined, start) {
      var self = this, reach = {};
      var visit = function(name) {
        if ( reach[name] || ! defined.hasOwnProperty(name) ) return;
        reach[name] = true;
        self.walk_(defined[name], function(p) {
          if ( foam.parse.Symbol.isInstance(p) ) visit(p.name);
        });
      };
      visit(start);
      return reach;
    },

    // ---- matching the empty string ---------------------------------------

    function nullableRules_(symbols, defined, opt_where) {
      /** rule name -> true when the rule can succeed without reading a character. Fixed point over the rules. */
      var map = {}, changed = true, self = this;
      symbols.forEach(function(s) { map[s.name] = false; });
      while ( changed ) {
        changed = false;
        symbols.forEach(function(s) {
          if ( ! map[s.name] && self.nullable_(defined[s.name], map, new Map(), opt_where) ) {
            map[s.name] = true;
            changed = true;
          }
        });
      }
      return map;
    },

    function nullable_(p, rules, memo, opt_where) {
      /**
       * True when p can succeed without reading a character. A parser class
       * this does not know is assumed to read, so the checks built on this
       * miss problems rather than report ones that are not there.
       * opt_where: 'mid' = before the end of the input, where eof() fails;
       * 'end' = at the end, where not(x) fails whenever x matches empty;
       * omitted = either.
       */
      if ( ! p || ! p.cls_ ) return false;
      if ( memo.has(p) ) return memo.get(p);
      memo.set(p, false); // a parser graph that loops back on itself reads nothing new

      var P = foam.parse, self = this;
      var n = function(q) { return self.nullable_(q, rules, memo, opt_where); };
      var r;

      if      ( P.Symbol.isInstance(p) )                                 r = !! rules[p.name];
      else if ( P.Literal.isInstance(p) || P.LiteralIC.isInstance(p) )   r = ! p.s;
      else if ( P.UntilLiteral.isInstance(p) || P.UntilLiteral0.isInstance(p) ) r = ! p.s;
      else if ( P.EOF.isInstance(p) )                                    r = opt_where !== 'mid';
      else if ( P.Optional.isInstance(p) || P.Peek.isInstance(p) )       r = true;
      else if ( P.Not.isInstance(p) )                                    r = ( opt_where !== 'end' || ! n(p.p) ) && ( ! p.else || n(p.else) );
      else if ( P.Repeat.isInstance(p) )                                 r = p.minimum <= 0 || n(p.p);
      else if ( P.Alternate.isInstance(p) )                              r = p.args.some(n);
      else if ( P.Sequence.isInstance(p) || P.Sequence0.isInstance(p) || P.Sequence1.isInstance(p) ) r = p.args.every(n);
      else if ( P.Grammar.isInstance(p) )                                r = false;
      else if ( P.ParserDecorator.isInstance(p) )                        r = n(p.p);
      else                                                               r = false;

      memo.set(p, r);
      return r;
    },

    // ---- left recursion --------------------------------------------------

    function leftSymbols_(p, rules, out, seen) {
      /** Rule names p may call at the position it starts at, before reading anything. */
      if ( ! p || ! p.cls_ || seen.has(p) ) return;
      seen.add(p);
      var P = foam.parse, self = this;
      var l = function(q) { self.leftSymbols_(q, rules, out, seen); };

      if ( P.Symbol.isInstance(p) ) { out.add(p.name); return; }
      if ( P.Sequence.isInstance(p) || P.Sequence0.isInstance(p) || P.Sequence1.isInstance(p) ) {
        for ( var i = 0 ; i < p.args.length ; i++ ) {
          l(p.args[i]);
          if ( ! this.nullable_(p.args[i], rules, new Map()) ) break;
        }
        return;
      }
      if ( P.Alternate.isInstance(p) ) { p.args.forEach(l); return; }
      if ( P.Not.isInstance(p) )       { l(p.p); l(p.else); return; }
      if ( P.Grammar.isInstance(p) )   return;
      if ( P.ParserDecorator.isInstance(p) ) l(p.p); // Repeat's delimiter comes after an item, so it is not at the start
      // Unknown class: not followed, same reasoning as nullable_.
    },

    function leftCycles_(symbols, defined, nullable) {
      /** Groups of rules that reach each other through leftSymbols_ (Tarjan's strongly connected components), declaration order. */
      var self = this, edges = {};
      symbols.forEach(function(s) {
        var out = new Set();
        self.leftSymbols_(defined[s.name], nullable, out, new Set());
        edges[s.name] = Array.from(out).filter(function(t) { return defined.hasOwnProperty(t); });
      });

      var index = 0, stack = [], on = {}, idx = {}, low = {}, groups = [];
      var connect = function(v) {
        idx[v] = low[v] = index++;
        stack.push(v); on[v] = true;
        edges[v].forEach(function(w) {
          if ( idx[w] === undefined ) { connect(w); low[v] = Math.min(low[v], low[w]); }
          else if ( on[w] ) low[v] = Math.min(low[v], idx[w]);
        });
        if ( low[v] === idx[v] ) {
          var group = [], w;
          do { w = stack.pop(); on[w] = false; group.push(w); } while ( w !== v );
          if ( group.length > 1 || edges[v].indexOf(v) >= 0 ) groups.push(group);
        }
      };
      var names = symbols.map(function(s) { return s.name; });
      names.forEach(function(v) { if ( idx[v] === undefined ) connect(v); });

      return groups.map(function(g) {
        return g.sort(function(a, b) { return names.indexOf(a) - names.indexOf(b); });
      });
    },

    // ---- helpers ---------------------------------------------------------

    function isGrammarClass_(cls) {
      /**
       * A concrete class whose instances are grammars to check; the framework
       * bases are not. Compared by id: a class from requires is a wrapper
       * (Object.create(cls)), not the class itself.
       */
      return foam.parse.Grammar.isSubClass(cls) &&
        cls.id !== 'foam.parse.Grammar' &&
        cls.id !== 'foam.parse.ImperativeGrammar' &&
        ! ( cls.model_ && cls.model_.abstract );
    },

    function isChecked(cls) {
      /** True when lintClasses checks something on cls: a grammar class, or its own grammars: axiom. */
      return this.isGrammarClass_(cls) || cls.getOwnAxiomsByClass(foam.parse.GrammarAxiom).length > 0;
    },

    function hasRule_(grammar, name) {
      return ( grammar.symbols || [] ).some(function(s) { return s.name === name; });
    },

    function rulesOwner_(cls) {
      /** The nearest class, cls or a base, that declares grammar() or symbols. */
      for ( var c = cls ; c && c !== foam.parse.Grammar ; c = foam.lookup(c.model_.extends, true) ) {
        if ( c.hasOwnAxiom('grammar') || c.hasOwnAxiom('symbols') ) return c;
      }
      return foam.parse.Grammar;
    },

    function methodActionNames_(cls) {
      /**
       * Rule names the class itself declares actions for: methods named
       * <rule>Action. Inherited ones are checked on the class declaring them.
       * Methods foam.parse.Grammar itself defines (addAction) are not actions.
       */
      return cls.getOwnAxiomsByClass(foam.lang.Method)
        .map(function(m) { return m.name; })
        .filter(function(name) {
          return name.length > 6 && name.endsWith('Action') && ! ( name in foam.parse.Grammar.prototype );
        })
        .map(function(name) { return name.substring(0, name.length - 6); });
    },

    function firstLine_(e) {
      return String(( e && e.message ) || e).split('\n')[0];
    }
  ]
});
