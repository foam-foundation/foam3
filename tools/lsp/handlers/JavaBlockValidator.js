/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'JavaBlockValidator',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.Diagnostic'
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
    function validateModel(model, classId, diagnostics, fullText) {
      /** Validate Java code within a model using its fields directly. */
      this.validateImports_(model, diagnostics, fullText);
      this.validateGetters_(model, classId, diagnostics, fullText);
    },

    function validateImports_(model, diagnostics, fullText) {
      /** Check javaImports array for known bad packages. */
      var mappings = this.index.getJavaImportMappings();
      var imports = model.javaImports || [];

      for ( var i = 0 ; i < imports.length ; i++ ) {
        var imp = imports[i];
        for ( var bad in mappings ) {
          if ( imp === bad || imp.indexOf(bad) === 0 ) {
            var idx = fullText.indexOf(imp);
            if ( idx !== -1 ) {
              var pos = this.analyzer.offsetToPosition(fullText, idx);
              diagnostics.push(this.Diagnostic.create({
                range: {
                  start: pos,
                  end: { line: pos.line, character: pos.character + imp.length }
                },
                severity: this.Diagnostic.ERROR,
                message: "Wrong Java package: '" + imp + "' → use '" + mappings[bad] + "' instead"
              }));
            }
            break;
          }
        }
      }
    },

    function validateGetters_(model, classId, diagnostics, fullText) {
      /** Check getter/setter calls in Java code blocks against known properties. */
      if ( ! classId ) return;

      // Build property set: own model properties + implements + refines
      var propNames = {};

      (model.properties || []).forEach(function(p) {
        var name = typeof p === 'string' ? p : p.name;
        if ( name ) propNames[name.toLowerCase()] = true;
      });

      (model.implements || []).forEach(function(iface) {
        var id = typeof iface === 'string' ? iface : iface.path;
        if ( ! id ) return;
        var ifaceProps = this.index.getProperties(id);
        for ( var i = 0 ; i < ifaceProps.length ; i++ ) {
          propNames[ifaceProps[i].name.toLowerCase()] = true;
        }
      }.bind(this));

      if ( model.refines ) {
        var refProps = this.index.getProperties(model.refines);
        for ( var i = 0 ; i < refProps.length ; i++ ) {
          propNames[refProps[i].name.toLowerCase()] = true;
        }
      }

      // Also add inherited properties from the class if it exists in registry
      var cls = this.index.getClass(classId);
      if ( cls ) {
        var inhProps = cls.getAxiomsByClass(foam.lang.Property);
        for ( var i = 0 ; i < inhProps.length ; i++ ) {
          propNames[inhProps[i].name.toLowerCase()] = true;
        }
      }

      // For interfaces: include properties from all implementing classes
      // Interfaces reference properties that implementors provide (e.g., getInputFilePath())
      if ( model.type_ === 'INTERFACE' ) {
        var ifaceId = model.package ? model.package + '.' + model.name : model.name;
        var implementors = this.index.getImplementors(ifaceId);
        for ( var i = 0 ; i < implementors.length ; i++ ) {
          var implProps = this.index.getProperties(implementors[i]);
          for ( var j = 0 ; j < implProps.length ; j++ ) {
            propNames[implProps[j].name.toLowerCase()] = true;
          }
        }
      }

      // Check all Java code strings on the model AND on each property
      var javaKeys = ['javaCode', 'javaPreSet', 'javaPostSet', 'javaFactory', 'javaGetter'];
      var self = this;

      function checkJavaBlock(key, javaStr) {
        if ( ! javaStr || typeof javaStr !== 'string' ) return;
        // Find this Java string's position in fullText for accurate diagnostics
        var baseOffset = fullText.indexOf(javaStr);
        if ( baseOffset === -1 ) return;

        var getSetRegex = /(get|set)([A-Z][a-zA-Z0-9_]*)\s*\(/g;
        var gs;
        while ( ( gs = getSetRegex.exec(javaStr) ) !== null ) {
          var charBefore = gs.index > 0 ? javaStr[gs.index - 1] : ' ';
          if ( charBefore === '.' || charBefore === ')' || charBefore === ']' ) continue;

          var propName = gs[2].charAt(0).toLowerCase() + gs[2].substring(1);
          if ( ['x', 'class', 'classInfo', 'ownClassInfo', 'instance', 'logger'].indexOf(propName) !== -1 ) continue;

          if ( ! propNames[propName.toLowerCase()] ) {
            var absOffset = baseOffset + gs.index;
            var pos = self.analyzer.offsetToPosition(fullText, absOffset);
            diagnostics.push(self.Diagnostic.create({
              range: {
                start: pos,
                end: { line: pos.line, character: pos.character + gs[0].length - 1 }
              },
              severity: self.Diagnostic.INFORMATION,
              message: "Property '" + propName + "' not found on " + classId
            }));
          }
        }
      }

      javaKeys.forEach(function(key) { checkJavaBlock(key, model[key]); });
      (model.properties || []).forEach(function(p) {
        if ( typeof p !== 'object' ) return;
        javaKeys.forEach(function(key) { checkJavaBlock(key, p[key]); });
      });
    }
  ]
});
