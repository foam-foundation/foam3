/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'ReferencesHandler',

  documentation: 'Find all references to a class: subclasses, implementors, and files that require or use it via `of:`.',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.CursorAnalyzer'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FoamIndex',
      name: 'index',
      factory: function() { return this.FoamIndex.create(); }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CursorAnalyzer',
      name: 'analyzer',
      factory: function() { return this.CursorAnalyzer.create(); }
    }
  ],

  methods: [
    function handle(text, position, opt_uri) {
      var word = this.analyzer.getDottedWordAtPosition(text, position);
      if ( ! word ) return [];

      var classId = word;
      if ( ! this.index.classExists(classId) ) {
        var propTypes = this.index.getPropertyTypes();
        for ( var i = 0 ; i < propTypes.length ; i++ ) {
          if ( propTypes[i].name === word ) { classId = propTypes[i].id; break; }
        }
      }
      if ( ! this.index.classExists(classId) ) return [];

      // Collect referencing class IDs from every angle. Dedup — a class may
      // both extend and require the target (rare, but keep it honest).
      var seen = {};
      var refs = [];
      function add(id) { if ( id && ! seen[id] ) { seen[id] = true; refs.push(id); } }

      var subs  = this.index.getSubclasses(classId);
      var impls = this.index.getImplementors(classId);
      var reqs  = this.index.getRequirers(classId);
      var ofs   = this.index.getOfUsers(classId);
      for ( var i = 0 ; i < subs.length ; i++ )  add(subs[i]);
      for ( var i = 0 ; i < impls.length ; i++ ) add(impls[i]);
      for ( var i = 0 ; i < reqs.length ; i++ )  add(reqs[i]);
      for ( var i = 0 ; i < ofs.length ; i++ )   add(ofs[i]);

      var locations = [];
      for ( var i = 0 ; i < refs.length ; i++ ) {
        var loc = this.buildLocation_(refs[i], classId);
        if ( loc ) locations.push(loc);
      }
      return locations;
    },

    function buildLocation_(refClassId, targetClassId) {
      /**
       * Build an LSP Location pointing at the referencing file. When the
       * target class ID appears literally in the referencer's source text,
       * point at its exact occurrence; otherwise fall back to line 0.
       */
      var filePath = this.index.getFilePath(refClassId);
      if ( ! filePath ) return null;

      var line = 0, ch = 0;
      try {
        var fs_ = require('fs');
        var content = fs_.readFileSync(filePath, 'utf8');
        var idx = content.indexOf(targetClassId);
        if ( idx !== -1 ) {
          for ( var i = 0 ; i < idx ; i++ ) {
            if ( content[i] === '\n' ) { line++; ch = 0; } else ch++;
          }
          return {
            uri: 'file://' + filePath,
            range: {
              start: { line: line, character: ch },
              end:   { line: line, character: ch + targetClassId.length }
            }
          };
        }
      } catch ( e ) {}

      return {
        uri: 'file://' + filePath,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
      };
    }
  ]
});
