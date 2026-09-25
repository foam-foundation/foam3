/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'InlayHintHandler',

  documentation: `
    textDocument/inlayHint: short, read-only notes the editor draws inline in
    a FOAM model file, for facts the source does not show.

      after a class's name      "×2 refinements"  — other files refine this
                                class; count from FoamIndex.getRefinements
                                (the refinement index the POM walk builds).
      after a property's name   ": String"        — the property has no
                                class: of its own, so its type is inherited;
                                read from the registry's resolved axiom.
      after a property's name   "overrides View"  — a superclass already
                                declares this property; names the class
                                whose declaration it replaces.

    Positions come from the grammar's model extents
    (FoamClassGrammar.collectModelExtents), the same harvest the document
    outline uses. Types and overrides come from the BOOTED registry, so they
    describe the class as last loaded: a property added since then has no
    axiom yet and gets no hint, rather than a guessed one.

    Journals (.jrl) get no hints: the classifier gate admits class files only.
  `,

  requires: [
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.FileModelCache'
  ],

  constants: {
    // LSP InlayHintKind. The override note has no kind: it is neither a type
    // nor a parameter name, and a kind makes some clients style it as one.
    KIND_TYPE: 1
  },

  properties: [
    {
      name: 'fileClassifier',
      documentation: `The one answer to "is this a FOAM class file". server.js
        wires its own shared instance so guard and handler cannot disagree and
        the per-uri memo stays warm; the factory keeps handler-direct tests
        working unwired.`,
      factory: function() { return foam.parse.lsp.FileClassifier.create(); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FoamIndex',
      name: 'index'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FileModelCache',
      name: 'cache',
      factory: function() { return this.FileModelCache.create(); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    },
    {
      name: 'grammar',
      documentation: `Source of model and member extents. server.js passes
        its shared instance; the factory reuses the index's own, since building
        one walks every class id.`,
      factory: function() { return this.index.getGrammar(); }
    }
  ],

  methods: [
    function handle(text, range, opt_uri) {
      /**
       * InlayHint[] for `text`, keeping only hints whose position falls
       * inside `range` (the visible part of the editor, per the protocol).
       * A missing range means the whole document.
       */
      var uri = opt_uri || '';
      if ( this.fileClassifier.classify(uri, text) !== 'class' ) return [];

      var models = this.cache.getModels(uri, text);
      var pos    = this.analyzer.offsetMapper(text);
      var path   = require('../uri').uriToPath(uri);
      var hints  = [];

      for ( var i = 0 ; i < models.length ; i++ ) {
        var m = models[i];
        if ( m.type_ === 'LIB' || m.type_ === 'RELATIONSHIP' ) continue;
        var extent = this.grammar.modelEntryFor(text, m);
        if ( ! extent || ! extent.closed ) continue;

        this.refinementHint_(text, m, extent, path, pos, hints);
        this.propertyHints_(text, m, extent, pos, hints);
      }

      if ( ! range ) return hints;
      return hints.filter(function(h) {
        return ! before_(h.position, range.start) && ! before_(range.end, h.position);
      });

      function before_(a, b) {
        return a.line < b.line || ( a.line === b.line && a.character < b.character );
      }
    },

    function refinementHint_(text, m, extent, path, pos, hints) {
      /**
       * "×N refinements" after the class's name (or its foam.CLASS( when it
       * has none). Only for a class's own declaration — on a refinement the
       * note would count its siblings, which is not what it says. Rows from
       * this same file are left out: a refinement written next to its class
       * is on screen already.
       */
      if ( m.refines || ! m.name || ! this.index ) return;
      var classId = this.cache.getClassId(m);
      var refs = this.index.getRefinements(classId).filter(function(r) {
        return r.path !== path;
      });
      if ( ! refs.length ) return;

      var at = extent.nameStart !== null ? this.afterQuote_(text, extent.nameEnd) : extent.headEnd;
      hints.push({
        position:    pos(at),
        label:       '×' + refs.length + ( refs.length === 1 ? ' refinement' : ' refinements' ),
        paddingLeft: true,
        tooltip:     'Refined in:\n' + refs.map(function(r) {
          return r.path + ':' + ( r.line + 1 );
        }).join('\n')
      });
    },

    function propertyHints_(text, m, extent, pos, hints) {
      /**
       * The inherited type and the override note, after each property's name.
       * Both read the registry, so a class that is not loaded gets neither.
       */
      if ( ! this.index ) return;
      var classId = this.cache.getClassId(m);
      var cls     = classId && this.index.getClass(classId);
      if ( ! cls ) return;
      // A refinement changes the class itself; nothing it declares
      // "overrides" in the superclass sense, so only its types are noted.
      var parent  = m.refines ? null : this.parentClass_(m);

      // No prototype: a property named `constructor` or `toString` must not
      // find Object's own member here.
      var raw = Object.create(null);
      ( m.properties || [] ).forEach(function(p) {
        var n = typeof p === 'string' ? p : ( p && p.name );
        if ( n && ! raw[n] ) raw[n] = p;
      });

      var seen = Object.create(null);
      for ( var i = 0 ; i < extent.properties.length ; i++ ) {
        var e = extent.properties[i];
        if ( seen[e.name] || ! raw[e.name] ) continue;
        seen[e.name] = true;
        var at = pos(this.afterQuote_(text, e.nameEnd));

        var own = raw[e.name];
        if ( typeof own === 'string' || ! own.class ) {
          var type = this.inheritedType_(cls, e.name);
          if ( type ) {
            hints.push({ position: at, label: ': ' + type, kind: this.KIND_TYPE, paddingLeft: true });
          }
        }

        var over = parent && this.overriddenIn_(parent, e.name);
        if ( over ) {
          hints.push({ position: at, label: 'overrides ' + over, paddingLeft: true,
            tooltip: 'Also declared by ' + over + ', a superclass of ' + classId });
        }
      }
    },

    function inheritedType_(cls, name) {
      /**
       * Short name of the property class the registry resolved for `name`,
       * or null when there is nothing worth saying. A plain foam.lang.Property
       * is skipped: "untyped" is what a missing class: already reads as.
       */
      var prop = cls.getAxiomByName(name);
      if ( ! prop || ! foam.lang.Property.isInstance(prop) ) return null;
      if ( prop.cls_ === foam.lang.Property ) return null;
      return prop.cls_ && prop.cls_.model_ ? prop.cls_.model_.name : null;
    },

    function overriddenIn_(parent, name) {
      /** Short name of the superclass that last declared property `name`,
       *  or null when no superclass has one. */
      var prop = parent.getAxiomByName(name);
      if ( ! prop || ! foam.lang.Property.isInstance(prop) ) return null;
      return prop.sourceCls_ ? prop.sourceCls_.name : parent.name;
    },

    function parentClass_(m) {
      /** The superclass `m` names in `extends:` (FObject when it names none),
       *  tried as written and then inside m's own package — FOAM accepts a
       *  bare name for a sibling class. */
      var ext = m.extends || 'foam.lang.FObject';
      return this.index.getClass(ext) ||
        ( m.package ? this.index.getClass(m.package + '.' + ext) : null );
    },

    function afterQuote_(text, nameEnd) {
      /** Offset just past a name's closing quote, where a hint reads as
       *  trailing the name. A name still being typed may have no quote yet. */
      var c = text.charAt(nameEnd);
      return ( c === "'" || c === '"' || c === '`' ) ? nameEnd + 1 : nameEnd;
    }
  ]
});
