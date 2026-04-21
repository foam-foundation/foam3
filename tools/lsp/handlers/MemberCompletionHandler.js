/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'MemberCompletionHandler',

  requires: [
    'foam.parse.lsp.FoamIndex',
    'foam.parse.lsp.FileModelCache',
    'foam.parse.lsp.CursorAnalyzer',
    'foam.parse.lsp.TypeTracker'
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
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.TypeTracker',
      name: 'typeTracker'
    }
  ],

  methods: [
    function handle(text, position, opt_uri) {
      if ( ! this.analyzer.isFoamFile(text) ) {
        return { isIncomplete: false, items: [] };
      }

      var lines = text.split('\n');
      var line = lines[position.line] || '';
      var prefix = line.substring(0, position.character);

      // Detect context: this.X.create({ ▊ }) — on the same line
      var createMatch = prefix.match(/this\.(\w+)\.create\(\s*\{\s*\w*$/);
      if ( createMatch ) {
        return this.handleCreateCompletion(text, createMatch[1], position, opt_uri);
      }

      // Detect context: ClassName.create({ ▊ }) — full class name, same line
      var fullCreateMatch = prefix.match(/([\w.]+)\.create\(\s*\{\s*\w*$/);
      if ( fullCreateMatch ) {
        var classId = fullCreateMatch[1];
        var resolved = this.analyzer.resolveShortName(text, classId) || classId;
        if ( this.index.classExists(resolved) ) {
          return this.getClassPropertyItems(resolved);
        }
      }

      // Detect context: cursor INSIDE a .create({ ... }) block on a separate line
      var createCtx = this.analyzer.findCreateContext(lines, position.line, text, this.index);
      if ( createCtx ) {
        return this.getClassPropertyItems(createCtx);
      }

      // Detect context: x. ▊ where x is a typed variable from .create()
      var varMatch = prefix.match(/(\w+)\.\w*$/);
      if ( varMatch && varMatch[1] !== 'this' && varMatch[1] !== 'foam' ) {
        var model = this.cache.getModelAt(opt_uri || '', text, position.line);
        var varType = this.typeTracker ? this.typeTracker.resolveVariableType(text, position, varMatch[1], model, this.index) : null;
        if ( varType ) {
          return this.getClassMemberItems(varType);
        }
      }

      // Detect context: this.RequiredClass. ▊ — suggest create() and class constants
      var reqClassMatch = prefix.match(/this\.([A-Z]\w*)\.\w*$/);
      if ( reqClassMatch ) {
        var requiresMap = this.cache.resolveRequiresMap(opt_uri, text, this.analyzer, position.line);
        var fullId = requiresMap[reqClassMatch[1]];
        if ( fullId && this.index.classExists(fullId) ) {
          return this.getRequiredClassItems(fullId);
        }
      }

      // Detect context: this. ▊ — suggest members + requires + imports
      if ( /this\.\w*$/.test(prefix) ) {
        return this.handleThisCompletion(text, position, opt_uri);
      }

      return { isIncomplete: false, items: [] };
    },

    function handleThisCompletion(text, position, opt_uri) {
      /** Suggest: own properties, methods, actions, required classes, imports. */
      var model = this.cache.getModelAt(opt_uri || '', text, position.line);
      var classId = this.cache.getClassId(model);

      // Fallback: if eval failed (SyntaxError from incomplete code like 'this.'),
      // resolve classId from regex
      if ( ! classId ) {
        classId = this.analyzer.resolveClassId(text);
      }

      var items = [];

      // Properties (own + inherited) — only if class exists in registry
      var props = classId ? this.index.getProperties(classId) : [];
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
        var propDoc = '**' + p.name + '** (`' + typeName + '`)';
        if ( p.documentation ) propDoc += '\n\n' + p.documentation;
        items.push({
          label: p.name,
          kind: 10,
          detail: typeName,
          documentation: { kind: 'markdown', value: propDoc },
          sortText: '!' + p.name
        });
      }

      // Methods — with parameter signatures
      var methods = classId ? this.index.getMethods(classId) : [];
      for ( var i = 0 ; i < methods.length ; i++ ) {
        var m = methods[i];
        var sig = this.analyzer.getMethodSignature(m);
        var doc = '```javascript\n' + sig + '\n```';
        if ( m.documentation ) doc += '\n\n' + m.documentation;
        items.push({
          label: m.name,
          kind: 2,
          detail: sig,
          documentation: { kind: 'markdown', value: doc },
          insertText: m.name + '()',
          sortText: '!1_' + m.name
        });
      }

      // Actions
      var actions = classId ? this.index.getActions(classId) : [];
      for ( var i = 0 ; i < actions.length ; i++ ) {
        items.push({
          label: actions[i].name,
          kind: 2,
          detail: 'Action',
          documentation: actions[i].documentation || '',
          sortText: '1_' + actions[i].name
        });
      }

      // Required classes (model-first, text fallback) — this.ShortName is available
      var requiresMap = this.cache.resolveRequiresMap(opt_uri, text, this.analyzer, position.line);
      for ( var alias in requiresMap ) {
        var fullId = requiresMap[alias];
        var cls = this.index.getClass(fullId);
        var rdoc = cls && cls.model_ ? ( cls.model_.documentation || '' ) : '';
        items.push({
          label: alias,
          kind: 7,
          detail: fullId,
          documentation: rdoc.substring(0, 100),
          sortText: '!2_' + alias
        });
      }

      // Imports — model-first (preserves shape), text fallback
      var importNames = [];
      if ( model ) {
        var imports = model.imports || [];
        for ( var i = 0 ; i < imports.length ; i++ ) {
          var imp = imports[i];
          var name = typeof imp === 'string' ? imp : imp.name;
          importNames.push(name.replace(/\?$/, ''));
        }
      } else {
        importNames = this.analyzer.parseImports(text);
      }
      for ( var i = 0 ; i < importNames.length ; i++ ) {
        items.push({
          label: importNames[i],
          kind: 10,
          detail: 'import',
          sortText: '!2_' + importNames[i]
        });
      }

      return { isIncomplete: false, items: items };
    },

    function handleCreateCompletion(text, shortName, position, opt_uri) {
      /** Resolve short name from requires, then suggest its properties. */
      var fullId = this.analyzer.resolveShortName(text, shortName);
      if ( ! fullId ) return { isIncomplete: false, items: [] };
      return this.getClassPropertyItems(fullId);
    },

    function getClassMemberItems(classId) {
      /** Get completion items for properties + methods + actions of a class (for typed variables). */
      var items = [];

      // Properties
      var props = this.index.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
        items.push({
          label: p.name,
          kind: 10,
          detail: typeName + ' — ' + classId,
          documentation: p.documentation || '',
          sortText: '!' + p.name
        });
      }

      // Methods
      var methods = this.index.getMethods(classId);
      for ( var i = 0 ; i < methods.length ; i++ ) {
        var m = methods[i];
        var sig = this.analyzer.getMethodSignature(m);
        items.push({
          label: m.name,
          kind: 2,
          detail: sig,
          documentation: m.documentation || '',
          insertText: m.name + '()',
          sortText: '!1_' + m.name
        });
      }

      // Actions
      var actions = this.index.getActions(classId);
      for ( var i = 0 ; i < actions.length ; i++ ) {
        items.push({
          label: actions[i].name,
          kind: 2,
          detail: 'Action — ' + classId,
          documentation: actions[i].documentation || '',
          sortText: '!1_' + actions[i].name
        });
      }

      return { isIncomplete: false, items: items };
    },

    function getRequiredClassItems(classId) {
      /** Get completion items for a required class: enum values, create(), constants. */
      var items = [];

      // If it's an enum, suggest its ordinal values (primary usage)
      var enumValues = this.index.getEnumValues(classId);
      if ( enumValues && enumValues.length > 0 ) {
        for ( var i = 0 ; i < enumValues.length ; i++ ) {
          var v = enumValues[i];
          items.push({
            label: v.name,
            kind: 13, // EnumMember
            detail: classId + '.' + v.name + ( v.label ? ' — ' + v.label : '' ),
            documentation: v.label || '',
            sortText: '!0_' + ('0000' + v.ordinal).slice(-4)
          });
        }
        return { isIncomplete: false, items: items };
      }

      // create() — primary action on a required class
      var props = this.index.getOwnProperties(classId);
      var propNames = props.slice(0, 5).map(function(p) { return p.name; }).join(', ');
      items.push({
        label: 'create',
        kind: 2,
        detail: classId + '.create({})',
        documentation: { kind: 'markdown', value: '```foam\n' + classId + '.create()\n```\nCreate a new instance.' + ( propNames ? '\n\nProperties: `' + propNames + '`...' : '' ) },
        insertText: 'create({\n  $0\n})',
        insertTextFormat: 2,
        sortText: '!0_create'
      });

      // Static property constants: CLASS_NAME.PROPERTY_NAME
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var constName = p.name.replace(/([A-Z])/g, '_$1').toUpperCase();
        var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
        items.push({
          label: constName,
          kind: 21,
          detail: typeName + ' axiom',
          documentation: p.documentation || '',
          sortText: '!1_' + constName
        });
      }

      // getAxiomByName, isInstance, isSubClass — common static methods
      var staticMethods = ['isInstance', 'isSubClass', 'getAxiomByName', 'getAxiomsByClass'];
      for ( var i = 0 ; i < staticMethods.length ; i++ ) {
        items.push({
          label: staticMethods[i],
          kind: 2,
          detail: 'static method',
          insertText: staticMethods[i] + '($0)',
          insertTextFormat: 2,
          sortText: '!2_' + staticMethods[i]
        });
      }

      return { isIncomplete: false, items: items };
    },

    function getClassPropertyItems(classId) {
      /** Get completion items for all properties of a class (for .create({})). */
      var props = this.index.getProperties(classId);
      var items = [];
      for ( var i = 0 ; i < props.length ; i++ ) {
        var p = props[i];
        var typeName = p.cls_ && p.cls_.model_ ? p.cls_.model_.name : 'Property';
        items.push({
          label: p.name,
          kind: 10,
          detail: typeName + ' — ' + classId,
          documentation: p.documentation || '',
          insertText: p.name + ': ',
          sortText: '!' + p.name,
          preselect: i === 0
        });
      }
      return { isIncomplete: false, items: items };
    }
  ]
});
