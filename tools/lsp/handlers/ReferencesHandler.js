/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'ReferencesHandler',

  documentation: 'Find all references: subclasses, implementors, and files that require a class.',

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

      var locations = [];

      var subs = this.index.getSubclasses(classId);
      for ( var i = 0 ; i < subs.length ; i++ ) {
        this.addLocation_(locations, subs[i]);
      }

      var impls = this.index.getImplementors(classId);
      for ( var i = 0 ; i < impls.length ; i++ ) {
        this.addLocation_(locations, impls[i]);
      }

      return locations;
    },

    function addLocation_(locations, refClassId) {
      var filePath = this.index.getFilePath(refClassId);
      if ( ! filePath ) return;
      locations.push({
        uri: 'file://' + filePath,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
      });
    }
  ]
});
