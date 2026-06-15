/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'FoamIndex',

  documentation: 'Query layer over the FOAM runtime class registry for LSP handlers.',

  properties: [
    {
      name: 'cache_',
      factory: function() { return {}; }
    },
    {
      name: 'fileIndex_',
      documentation: 'Class ID to file path mapping built from foam.poms.'
    },
    {
      name: 'javaMethodCache_',
      documentation: 'Class ID → array of { name, sig, doc } for Java-only methods.',
      factory: function() { return {}; }
    },
    {
      name: 'symbolIndex_',
      documentation: 'Flat workspace symbol array — lazy, built on first searchSymbols call. Entries: { name, kind, classId, filePath, containerName }.'
    },
    {
      name: 'grammar_',
      documentation: 'Cached FoamClassGrammar instance. Building one walks every class id and builds N parser alternatives — share it across handlers.'
    }
  ],

  methods: [
    function getAllClassIds() {
      /**
       * Returns all known class IDs.
       * Uses __cache__ (not USED/UNUSED) because bootstrap classes
       * (FObject, Boolean, String, Property, etc.) are registered
       * in the context cache but never tracked in USED/UNUSED.
       */
      var cache = foam.__context__.__cache__;
      var ids = [];
      for ( var key in cache ) {
        // Skip short names (e.g., 'FObject' vs 'foam.lang.FObject')
        // by only including dotted names
        if ( key.indexOf('.') !== -1 ) ids.push(key);
      }
      return ids;
    },

    function getClass(id) {
      /** Resolves a class by ID, returns null if not found. */
      return foam.maybeLookup(id);
    },

    function getGrammar() {
      /** Returns a cached FoamClassGrammar bound to this index. Handlers
       *  that parse source text should reuse this rather than build their
       *  own — construction walks every class id and builds N parser alts. */
      if ( ! this.grammar_ ) {
        this.grammar_ = foam.parse.lsp.FoamClassGrammar.create({ index: this });
      }
      return this.grammar_;
    },

    function classExists(id) {
      /** Returns true if the class ID is registered. */
      return foam.isRegistered(id);
    },

    function getPropertyTypes() {
      /** Finds all classes that extend foam.lang.Property. */
      if ( this.cache_.propertyTypes ) return this.cache_.propertyTypes;

      var PropertyClass = foam.lang.Property;
      var types = [];

      var ids = this.getAllClassIds();
      for ( var i = 0 ; i < ids.length ; i++ ) {
        try {
          var cls = foam.maybeLookup(ids[i]);
          if ( cls && PropertyClass.isSubClass(cls) ) {
            types.push({
              name: cls.model_.name,
              id:   cls.model_.id,
              doc:  cls.model_.documentation || ''
            });
          }
        } catch (x) {}
      }

      this.cache_.propertyTypes = types;
      return types;
    },

    function isInterface(classId) {
      /**
       * Returns true if `classId` was declared via foam.INTERFACE — i.e.,
       * its class extends foam.lang.AbstractInterface. The interface
       * subtype check is canonical: `foam.INTERFACE` sets
       * `extends: 'foam.lang.AbstractInterface'` on every interface.
       */
      var iface = foam.maybeLookup('foam.lang.AbstractInterface');
      if ( ! iface ) return false;
      var cls = foam.maybeLookup(classId);
      if ( ! cls ) return false;
      try { return iface.isSubClass(cls); } catch ( e ) { return false; }
    },

    function getInterfaceIds() {
      /**
       * Returns all class IDs declared via foam.INTERFACE — i.e., classes
       * whose own class extends foam.lang.AbstractInterface. Used by the
       * completion handler so `implements: [...]` suggests interfaces
       * specifically rather than every class id.
       */
      if ( this.cache_.interfaceIds ) return this.cache_.interfaceIds;

      var iface = foam.maybeLookup('foam.lang.AbstractInterface');
      if ( ! iface ) {
        this.cache_.interfaceIds = [];
        return this.cache_.interfaceIds;
      }

      var result = [];
      var ids = this.getAllClassIds();
      for ( var i = 0 ; i < ids.length ; i++ ) {
        try {
          var cls = foam.maybeLookup(ids[i]);
          if ( cls && cls !== iface && iface.isSubClass(cls) ) result.push(ids[i]);
        } catch ( e ) {}
      }

      this.cache_.interfaceIds = result;
      return result;
    },

    function getClassTypedPropertyNames() {
      /**
       * Names of axiom slots whose string value is a class id. Used by
       * FoamClassGrammar's classTypedSlotEntry rule.
       *
       * Returns the canonical eight slots that the FOAM JSON serializer
       * (foam/lang/JSON.js) treats as class-id-typed:
       *
       *   extends, implements, of, class, view, refines, sourceModel,
       *   targetModel
       *
       * An earlier version walked the registry to also include any axiom
       * whose property class was Class/Reference/FObjectProperty/
       * FObjectArray. That over-broad set caused false positives on
       * extremely common slot names (`label`, `name`, etc.) that happen
       * to be class-typed in some obscure model — e.g., `label:
       * 'Transaction Details'` was misparsed as a class ref. Stick to
       * the canonical list so the grammar doesn't fight content that
       * isn't a class id.
       *
       * If a custom axiom slot needs to be navigable as a class id,
       * define an explicit grammar entry for it (see refinesEntry /
       * sourceModelEntry / targetModelEntry as templates).
       */
      if ( this.cache_.classTypedNames ) return this.cache_.classTypedNames;
      var names = [
        'extends', 'implements', 'of', 'class', 'view',
        'sourceModel', 'targetModel', 'refines'
      ];
      this.cache_.classTypedNames = names;
      return names;
    },

    function getAxioms(classId) {
      /** Returns all axioms for a class including inherited. */
      var cls = this.getClass(classId);
      if ( ! cls ) return [];
      return cls.getAxioms();
    },

    function getProperties(classId) {
      /** Returns property axioms for a class. */
      var cls = this.getClass(classId);
      if ( ! cls ) return [];
      return cls.getAxiomsByClass(foam.lang.Property);
    },

    function getMethods(classId) {
      /** Returns method axioms for a class. */
      var cls = this.getClass(classId);
      if ( ! cls ) return [];
      return cls.getAxiomsByClass(foam.lang.Method);
    },

    function getJavaMethods(classId) {
      /**
       * Returns Java-only methods for a class (not in FOAM axioms).
       * Scanned from .java files alongside the .js model files.
       * Includes methods from the full inheritance chain.
       * Returns array of { name, sig, doc }.
       */
      if ( this.javaMethodCache_[classId] ) return this.javaMethodCache_[classId];

      var result = [];
      var seen = {};
      var chain = this.getInheritanceChain(classId);

      // Collect FOAM method names to exclude (we only want Java-only methods)
      var foamMethodNames = {};
      var foamMethods = this.getMethods(classId);
      for ( var i = 0 ; i < foamMethods.length ; i++ ) foamMethodNames[foamMethods[i].name] = true;

      for ( var c = 0 ; c < chain.length ; c++ ) {
        var cid = chain[c];
        var scanned = this.scanJavaFile_(cid);
        for ( var j = 0 ; j < scanned.length ; j++ ) {
          if ( ! seen[scanned[j].name] && ! foamMethodNames[scanned[j].name] ) {
            seen[scanned[j].name] = true;
            result.push(scanned[j]);
          }
        }
      }

      this.javaMethodCache_[classId] = result;
      return result;
    },

    function scanJavaFile_(classId) {
      /**
       * Scan the .java file for a FOAM class and extract method signatures.
       * Uses JavaParser (FOAM grammar-based) for structured parsing.
       * Returns array of { name, sig, doc, line, returnType, params, modifiers }.
       */
      var entry = this.fileIndex_ && this.fileIndex_[classId];
      if ( ! entry ) return [];

      var jsPath = typeof entry === 'string' ? entry : entry.path;
      if ( ! jsPath ) return [];

      var javaPath = jsPath.replace(/\.js$/, '.java');
      var fs_ = require('fs');
      if ( ! fs_.existsSync(javaPath) ) return [];

      try {
        var content = fs_.readFileSync(javaPath, 'utf8');
        var parser = foam.parse.lsp.JavaParser.create();
        var parsed = parser.parseFile(content);
        var simpleName = classId.split('.').pop();
        var result = [];
        for ( var i = 0 ; i < parsed.methods.length ; i++ ) {
          var m = parsed.methods[i];
          // Skip MethodInfo boilerplate
          if ( m.name === 'getName' || m.name === 'call' ) continue;
          // Skip constructors (return type matches class name)
          if ( m.name === simpleName && m.returnType === simpleName ) continue;
          result.push(m);
        }
        return result;
      } catch (e) {
        return [];
      }
    },

    function getActions(classId) {
      /** Returns action axioms for a class. */
      var cls = this.getClass(classId);
      if ( ! cls ) return [];
      return cls.getAxiomsByClass(foam.lang.Action);
    },

    function getSourceLocation(classId) {
      /** Returns { path, line } for a class definition. */
      var cls = this.getClass(classId);
      if ( ! cls ) return null;
      var m = cls.model_;
      // m.source is set by foam_node.js during loading (document.currentScript.src in browser)
      // In Node.js builds, source is tracked on the model object
      var source = m.source || (foam.USED[classId] && foam.USED[classId].source) ||
                   (foam.UNUSED[classId] && foam.UNUSED[classId].source);
      return source ? { path: source, line: 1 } : null;
    },

    function getInheritanceChain(classId) {
      /** Returns [classId, parentId, ..., 'foam.lang.FObject']. */
      var chain = [];
      var seen = {};
      var cls = this.getClass(classId);
      while ( cls && ! seen[cls.id] ) {
        seen[cls.id] = true;
        chain.push(cls.id);
        if ( ! cls.model_.extends || cls.id === 'foam.lang.FObject' ) break;
        cls = this.getClass(cls.model_.extends);
      }
      return chain;
    },

    function getSubclasses(classId) {
      /** Returns all direct subclasses of a class. */
      var subs = [];
      var ids = this.getAllClassIds();
      for ( var i = 0 ; i < ids.length ; i++ ) {
        var m = foam.USED[ids[i]] || foam.UNUSED[ids[i]];
        if ( m && m.extends === classId ) subs.push(ids[i]);
      }
      return subs;
    },

    function getAffectedFiles(classIds) {
      /**
       * Given a set of class IDs that have been re-registered (e.g. after
       * a save), return the set of source file paths whose diagnostics
       * could be affected:
       *   • the files that defined these classes
       *   • files containing direct subclasses (transitive)
       *   • files containing requirers of the classes (transitive on subclasses too)
       *   • files containing of-users of the classes
       *   • files containing implementers (when an interface is in the set)
       *
       * Used to narrow the post-save re-analyze to actual dependents
       * instead of scanning every FOAM file in the workspace.
       */
      var self = this;
      if ( ! this.fileIndex_ ) this.buildFileIndex();

      var affectedClassIds = {};
      var queue = [];
      (classIds || []).forEach(function(id) {
        if ( id && ! affectedClassIds[id] ) {
          affectedClassIds[id] = true;
          queue.push(id);
        }
      });

      // Transitive subclasses (class change propagates down the tree).
      while ( queue.length ) {
        var cur = queue.shift();
        var subs = self.getSubclasses(cur);
        for ( var i = 0 ; i < subs.length ; i++ ) {
          if ( ! affectedClassIds[subs[i]] ) {
            affectedClassIds[subs[i]] = true;
            queue.push(subs[i]);
          }
        }
      }

      // Direct requirers, of-users, implementers of any class in the set.
      var seeds = Object.keys(affectedClassIds);
      var extras = {};
      seeds.forEach(function(id) {
        self.getRequirers(id).forEach(function(r) { extras[r] = true; });
        self.getOfUsers(id).forEach(function(u)   { extras[u] = true; });
        self.getImplementors(id).forEach(function(m) { extras[m] = true; });
      });
      Object.keys(extras).forEach(function(id) { affectedClassIds[id] = true; });

      // Map class ids to their file paths. De-duplicate.
      var paths = {};
      Object.keys(affectedClassIds).forEach(function(id) {
        var fp = self.getFilePath(id);
        if ( fp ) paths[fp] = true;
      });
      return Object.keys(paths);
    },

    function getImplementors(interfaceId) {
      /**
       * Returns class IDs of all classes that implement the given interface.
       * Scans the FOAM registry — cached after first call per interface.
       */
      if ( this.cache_['impl_' + interfaceId] ) return this.cache_['impl_' + interfaceId];
      var result = [];
      var ids = this.getAllClassIds();
      for ( var i = 0 ; i < ids.length ; i++ ) {
        try {
          var cls = foam.maybeLookup(ids[i]);
          if ( ! cls || ! cls.model_ || ! cls.model_.implements ) continue;
          var impls = cls.model_.implements;
          for ( var j = 0 ; j < impls.length ; j++ ) {
            var implId = typeof impls[j] === 'string' ? impls[j] : (impls[j].path || '');
            if ( implId === interfaceId ) {
              result.push(ids[i]);
              break;
            }
          }
        } catch (e) {}
      }
      this.cache_['impl_' + interfaceId] = result;
      return result;
    },

    function getRequirers(classId) {
      /**
       * Return class IDs of all classes whose `requires: [...]` array
       * contains the given class. Cached.
       */
      if ( this.cache_['req_' + classId] ) return this.cache_['req_' + classId];
      var result = [];
      var ids = this.getAllClassIds();
      for ( var i = 0 ; i < ids.length ; i++ ) {
        try {
          var cls = foam.maybeLookup(ids[i]);
          if ( ! cls || ! cls.model_ ) continue;
          var reqs = cls.model_.requires || [];
          for ( var j = 0 ; j < reqs.length ; j++ ) {
            var r = reqs[j];
            var path = typeof r === 'string' ? r.split(/\s+as\s+/)[0].trim() : (r.path || '');
            if ( path === classId ) { result.push(ids[i]); break; }
          }
        } catch ( e ) {}
      }
      this.cache_['req_' + classId] = result;
      return result;
    },

    function getOfUsers(classId) {
      /**
       * Return class IDs of classes that have at least one property with
       * `of: classId`. Cached.
       */
      if ( this.cache_['of_' + classId] ) return this.cache_['of_' + classId];
      var result = [];
      var ids = this.getAllClassIds();
      for ( var i = 0 ; i < ids.length ; i++ ) {
        try {
          var cls = foam.maybeLookup(ids[i]);
          if ( ! cls || ! cls.model_ || ! cls.model_.properties ) continue;
          var props = cls.model_.properties;
          for ( var j = 0 ; j < props.length ; j++ ) {
            var p = props[j];
            if ( p && typeof p === 'object' && p.of === classId ) {
              result.push(ids[i]);
              break;
            }
          }
        } catch ( e ) {}
      }
      this.cache_['of_' + classId] = result;
      return result;
    },

    function getImports(classId) {
      /** Returns import axioms for a class. */
      var cls = this.getClass(classId);
      if ( ! cls ) return [];
      return cls.getAxiomsByClass(foam.lang.Import);
    },

    function getRequires(classId) {
      /** Returns requires axioms for a class. */
      var cls = this.getClass(classId);
      if ( ! cls ) return [];
      return cls.getAxiomsByClass(foam.lang.Requires);
    },

    function getMethodReturnType(classId, methodName) {
      /**
       * Resolve the return type of a method to a FOAM class id. Strategy,
       * in order of precedence:
       *   1. The method axiom's explicit `type:` field, resolved to a class id
       *      (short name via the class's requires, else suffix search).
       *   2. The method body's `code` (as a function/string). Parse for
       *      common `return …` patterns and resolve the target class id.
       * Returns null when nothing conclusive.
       */
      var method = this.findMethod_(classId, methodName);
      if ( ! method ) return null;

      // 1. Parse the code body for a concrete `return this.X.create(…)`. A
      //    parsed concrete class is more useful to the IDE than a declared
      //    interface type (e.g. DESC's `type: Comparator` vs code-returned
      //    concrete `Desc` — the concrete is what you can `.` into).
      var src = typeof method.code === 'function' ? method.code.toString()
              : typeof method.code === 'string'   ? method.code
              : null;
      if ( src ) {
        var parsed = this.parseReturnType_(classId, src);
        if ( parsed ) return parsed;
      }

      // 2. Fall back to the declared type: axiom.
      if ( method.type ) {
        return this.resolveShortClassName_(classId, method.type);
      }

      return null;
    },

    function findMethod_(classId, methodName) {
      var cls = this.getClass(classId);
      if ( ! cls ) return null;
      var methods = cls.getAxiomsByClass(foam.lang.Method);
      for ( var i = 0 ; i < methods.length ; i++ ) {
        if ( methods[i].name === methodName ) return methods[i];
      }
      return null;
    },

    function resolveShortClassName_(classId, name) {
      /**
       * Resolve `name` to a full class id. Order:
       *   - if fully qualified and known, return as-is
       *   - look up in the class's own requires list (handles 'as' aliases)
       *   - final fallback: suffix search through the full registry
       */
      if ( ! name || name === 'Void' || name === 'void' ) return null;
      if ( this.classExists(name) ) return name;

      var cls = this.getClass(classId);
      if ( cls ) {
        var reqs = cls.getAxiomsByClass(foam.lang.Requires);
        for ( var i = 0 ; i < reqs.length ; i++ ) {
          var alias = reqs[i].name;
          var path  = reqs[i].path;
          if ( alias === name || path.endsWith('.' + name) || path === name ) {
            return path;
          }
        }
      }

      var ids = this.getAllClassIds();
      var suffix = '.' + name;
      for ( var i = 0 ; i < ids.length ; i++ ) {
        if ( ids[i].endsWith(suffix) ) return ids[i];
      }
      return null;
    },

    function parseReturnType_(classId, src) {
      /**
       * Parse a JS function body source string for common return-type
       * patterns. First hit wins. Patterns in decreasing specificity:
       *
       *   return foam.pkg.Class.create(…)   → foam.pkg.Class
       *   return this.ShortName.create(…)   → short via class.requires
       *   return this._binary_("Name", …)   → Name short via class.requires
       *   return this._unary_("Name", …)    → same
       *   return this._nary_("Name", …)     → same
       *   return new foam.pkg.Class(…)      → foam.pkg.Class
       *   return new ShortName(…)           → short via class.requires
       */
      var patterns = [
        [ /return\s+(foam(?:\.\w+)+)\s*\.\s*create\s*\(/,   1, true  ],
        [ /return\s+this\s*\.\s*(\w+)\s*\.\s*create\s*\(/,  1, false ],
        [ /return\s+this\s*\.\s*_(?:binary|unary|nary)_\s*\(\s*['"](\w+)['"]/, 1, false ],
        [ /return\s+new\s+(foam(?:\.\w+)+)\s*\(/,           1, true  ],
        [ /return\s+new\s+(\w+)\s*\(/,                       1, false ]
      ];
      for ( var i = 0 ; i < patterns.length ; i++ ) {
        var m = src.match(patterns[i][0]);
        if ( ! m ) continue;
        var name = m[patterns[i][1]];
        var isFull = patterns[i][2];
        if ( isFull ) return this.classExists(name) ? name : null;
        return this.resolveShortClassName_(classId, name);
      }
      return null;
    },

    function getMessages(classId) {
      /**
       * Return the model's messages axiom entries as
       * [{ name, message }, …]. Includes inherited messages from
       * extends/implements chains so `this.LABEL_X` usages in a subclass
       * still resolve when the definition lives on a parent/mixin.
       */
      var out = [];
      var seen = {};
      var id = classId;
      var guard = 0;
      while ( id && guard++ < 50 ) {
        var cls = this.getClass(id);
        if ( ! cls ) break;
        var msgs = cls.model_ && cls.model_.messages;
        if ( msgs ) {
          for ( var i = 0 ; i < msgs.length ; i++ ) {
            var m = msgs[i];
            if ( ! m || ! m.name || seen[m.name] ) continue;
            seen[m.name] = true;
            out.push({ name: m.name, message: m.message, definerId: id });
          }
        }
        // Walk implements first, then extends.
        var impls = cls.model_ && cls.model_.implements;
        if ( impls ) {
          for ( var j = 0 ; j < impls.length ; j++ ) {
            var ifc = impls[j];
            var ip = typeof ifc === 'string' ? ifc : (ifc && ifc.path);
            var icls = ip && this.getClass(ip);
            var imsgs = icls && icls.model_ && icls.model_.messages;
            if ( imsgs ) {
              for ( var k = 0 ; k < imsgs.length ; k++ ) {
                var im = imsgs[k];
                if ( ! im || ! im.name || seen[im.name] ) continue;
                seen[im.name] = true;
                out.push({ name: im.name, message: im.message, definerId: ip });
              }
            }
          }
        }
        id = cls.model_ && cls.model_.extends;
      }
      return out;
    },

    function findMessage(classId, name) {
      /** Find a single message by name walking the inheritance chain. */
      var all = this.getMessages(classId);
      for ( var i = 0 ; i < all.length ; i++ ) {
        if ( all[i].name === name ) return all[i];
      }
      return null;
    },

    function getEnumValues(classId) {
      /** Returns enum values for an enum class. */
      var cls = this.getClass(classId);
      if ( ! cls || ! cls.VALUES ) return [];
      return cls.VALUES.map(function(v) {
        return { name: v.name, label: v.label, ordinal: v.ordinal };
      });
    },

    function getRelationships(classId) {
      /** Relationships (foam.dao.Relationship) this class participates in.
       *  A Relationship installs itself as an axiom on BOTH its source and
       *  target classes (Relationship.js:235,280), so getAxiomsByClass finds
       *  every one. Returns [{ dir: 'out'|'in', name, other, card }]. */
      var cls = this.getClass(classId);
      if ( ! cls || ! foam.dao.Relationship ) return [];
      var rels = cls.getAxiomsByClass(foam.dao.Relationship);
      var out = [];
      for ( var i = 0 ; i < rels.length ; i++ ) {
        var r = rels[i];
        var card = r.cardinality || '1:*';
        if ( r.sourceModel === classId ) {
          out.push({ dir: 'out', name: r.forwardName, other: r.targetModel, card: card });
        }
        if ( r.targetModel === classId && ! r.oneWay ) {
          out.push({ dir: 'in', name: r.inverseName, other: r.sourceModel, card: card });
        }
      }
      return out;
    },

    function getPropertyInfo(classId, propName) {
      /** General property resolver for value validation/completion. Returns
       *  { found, propClassName, isEnum, enumId, enumValues, primitiveKind }.
       *  primitiveKind ∈ {'int','float','boolean', null}. Enum detection is
       *  independent of the property's class name: a property whose `of`
       *  resolves to a class with VALUES is treated as an enum. */
      var info = { found: false, propClassName: null, isEnum: false,
                   enumId: null, enumValues: [], primitiveKind: null };
      var cls = this.getClass(classId);
      if ( ! cls ) return info;
      var prop = cls.getAxiomByName(propName);
      if ( ! prop || ! foam.lang.Property.isInstance(prop) ) return info;
      info.found = true;
      info.propClassName = ( prop.cls_ && prop.cls_.model_ ) ? prop.cls_.model_.name : null;

      var ofId = prop.of && ( prop.of.id || prop.of );
      if ( ofId ) {
        var vals = this.getEnumValues(ofId);
        if ( vals && vals.length > 0 ) {
          info.isEnum = true;
          info.enumId = ofId;
          info.enumValues = vals;
        }
      }
      if ( ! info.isEnum ) {
        switch ( info.propClassName ) {
          case 'Int': case 'Long':   info.primitiveKind = 'int';     break;
          case 'Float': case 'Double': info.primitiveKind = 'float'; break;
          case 'Boolean':            info.primitiveKind = 'boolean'; break;
        }
      }
      return info;
    },

    function getClassDoc(classId) {
      /** Build markdown hover content for a class. */
      var cls = this.getClass(classId);
      if ( ! cls ) return null;
      var m = cls.model_;

      var md = '**' + m.id + '**\n\n';
      if ( m.extends && m.extends !== 'FObject' ) md += 'extends `' + m.extends + '`\n\n';
      if ( m.documentation ) md += m.documentation + '\n\n';

      var props = this.getProperties(classId);
      if ( props.length ) {
        md += '**Properties:** ' + props.map(function(p) {
          return '`' + p.name + '`';
        }).join(', ') + '\n';
      }

      return md;
    },

    function getPropertyDoc(classId, propName) {
      /** Build markdown hover content for a property. Returns null if the
       *  named axiom isn't a real Property (so methods/actions fall through
       *  to their dedicated hover formatters instead of being mis-labeled). */
      var cls = this.getClass(classId);
      if ( ! cls ) return null;
      var prop = cls.getAxiomByName(propName);
      if ( ! prop || ! foam.lang.Property.isInstance(prop) ) return null;

      var md = '**' + propName + '** (' + (prop.cls_ && prop.cls_.model_ ? prop.cls_.model_.name : 'Property') + ')\n\n';
      if ( prop.documentation ) md += prop.documentation + '\n\n';
      if ( prop.value !== undefined && prop.value !== '' ) md += 'Default: `' + prop.value + '`\n';
      return md;
    },

    function invalidate(classId) {
      /** Clear cache for a class and dependents. */
      delete this.cache_[classId];
      delete this.cache_.propertyTypes;
      this.invalidateSymbolIndex_();
    },

    function invalidateAll() {
      /** Clear all caches. */
      this.cache_ = {};
    },

    function buildFileIndex() {
      /**
       * Build class ID → { path, flags } mapping by walking ALL POMs
       * recursively, including flag-filtered projects (test, swift, node).
       *
       * This gives the LSP complete knowledge of every class in the
       * codebase. The flags metadata lets the analyzer decide which
       * files to actually scan based on the user's active flags.
       *
       * fileIndex_ = {
       *   'foam.core.test.Test': { path: '/.../Test.js', flags: ['js', 'test'] },
       *   'foam.u2.Element':     { path: '/.../Element2.js', flags: ['web'] }
       * }
       */
      this.fileIndex_ = {};
      this.libIndex_ = {};
      var path_ = require('path');
      var fs_ = require('fs');

      // Walk loaded POMs first (these are already in foam.poms)
      var poms = foam.poms || [];
      for ( var p = 0 ; p < poms.length ; p++ ) {
        this.indexPomFiles_(poms[p], path_, fs_);
      }

      // Now walk flag-filtered sub-projects that were skipped during boot.
      // Re-read each POM's projects array and follow test/node/swift POMs.
      var visited = {};
      for ( var p = 0 ; p < poms.length ; p++ ) {
        this.walkSkippedProjects_(poms[p], path_, fs_, visited);
      }
    },

    function indexPomFiles_(pom, path_, fs_) {
      /** Index all files from a POM, storing flag metadata + pom location per class. */
      var location = pom.location || '';
      var pomFile  = path_.resolve(location, 'pom.js');
      var files = pom.files || [];

      for ( var f = 0 ; f < files.length ; f++ ) {
        var file = files[f];
        var filePath = path_.resolve(location, file.name + '.js');
        var fileFlags = file.flags ? String(file.flags).split('|').map(function(s) {
          return s.split('&');
        }).reduce(function(a, b) { return a.concat(b); }, []) : ['js'];

        this.indexFileClasses_(filePath, fileFlags, pomFile, file.name, fs_);
      }
    },

    function indexFileClasses_(filePath, fileFlags, pomFile, pomEntryName, fs_) {
      /**
       * Read a file and index every foam.CLASS/ENUM/INTERFACE/RELATIONSHIP/LIB
       * found, using eval-intercept via FileModelCache. Eval is the runtime's
       * own understanding of these calls and is strictly more correct than
       * regex: it captures RELATIONSHIPs (synthesized names), skips false
       * positives like `{name: 'properties'}` in inner objects, and surfaces
       * the refinement's own identity plus its target.
       *
       * Cost: roughly +200ms over regex at boot for 4000+ files — negligible
       * compared to the overall LSP boot time.
       */
      try {
        if ( ! fs_.existsSync(filePath) ) return;
        var content = fs_.readFileSync(filePath, 'utf8');
        if ( ! this.libIndex_ ) this.libIndex_ = {};
        var models = foam.parse.lsp.FileModelCache.create().parseFileModels(content);
        for ( var i = 0 ; i < models.length ; i++ ) {
          var m = models[i];
          if ( ! m.name ) continue;

          if ( m.type_ === 'LIB' ) {
            this.libIndex_[m.name] = {
              path:      filePath,
              line:      m.sourceLine_ || 0,
              methods:   this.extractLIBMethodNames_(m.methods),
              constants: this.extractLIBConstantNames_(m.constants)
            };
            continue;
          }

          // Index the model's own identity (package + name). Refinements also
          // index under their target class so lookups of the refined type find
          // the refining file.
          var ownId = m.package ? m.package + '.' + m.name : m.name;
          if ( ownId ) this.fileIndex_[ownId] = {
            path:         filePath,
            flags:        fileFlags,
            pomFile:      pomFile,
            pomEntryName: pomEntryName
          };
          if ( m.refines && ! this.fileIndex_[m.refines] ) {
            this.fileIndex_[m.refines] = {
              path:         filePath,
              flags:        fileFlags,
              pomFile:      pomFile,
              pomEntryName: pomEntryName
            };
          }
        }
      } catch ( e ) {}
    },

    function getPomLocationForClass(classId) {
      /**
       * Return { pomFile, line, character } for the POM entry that registers
       * a class — `{ name: 'Foo', flags: ... }` inside the nearest pom.js.
       * Used by DefinitionHandler so go-to-definition on a class's own name
       * jumps to its POM entry instead of staying on the declaration site.
       */
      if ( ! this.fileIndex_ ) this.buildFileIndex();
      var entry = this.fileIndex_[classId];
      if ( ! entry || ! entry.pomFile || ! entry.pomEntryName ) return null;
      var loc = this.findPomEntryLocation_(entry.pomFile, entry.pomEntryName);
      if ( ! loc ) return null;
      return { pomFile: entry.pomFile, line: loc.line, character: loc.character };
    },

    function getClassForPomEntry(pomFile, entryName) {
      /**
       * Reverse: given a pom.js file path and a file-entry name (`name: 'Foo'`),
       * return the registered class id. Used by DefinitionHandler so
       * go-to-definition on a POM entry jumps to the class file.
       */
      if ( ! this.fileIndex_ ) this.buildFileIndex();
      var path_ = require('path');
      var pomDir = path_.dirname(pomFile);
      var expectedPath = path_.resolve(pomDir, entryName + '.js');
      for ( var id in this.fileIndex_ ) {
        var entry = this.fileIndex_[id];
        var p = typeof entry === 'string' ? entry : entry.path;
        if ( p === expectedPath ) return id;
      }
      return null;
    },

    function findPomEntryLocation_(pomFile, entryName) {
      // Find the line + column of the `name: 'entryName'` slot inside the
      // pom.js. Cached per pom file. The lookup goes through FoamClassGrammar
      // — same parser the LSP uses everywhere else — so we never re-invent
      // POM tokenisation with regex.
      if ( ! this.pomEntryLineCache_ ) this.pomEntryLineCache_ = {};
      var cache = this.pomEntryLineCache_[pomFile];
      if ( ! cache ) {
        try {
          var text = require('fs').readFileSync(pomFile, 'utf8');
          cache = this.collectPomNameAxiomPositions_(text);
        } catch (e) {
          cache = {};
        }
        this.pomEntryLineCache_[pomFile] = cache;
      }
      return cache[entryName] || null;
    },

    function collectPomNameAxiomPositions_(pomText) {
      // Walk the pom.js as a stream of axiom positions emitted by
      // FoamClassGrammar (the parser the rest of the LSP uses for hover /
      // completion / diagnostics). The grammar's pomFileName rule wraps
      // both quote styles in quotedAny() and emits a position-tagged msg
      // so collectAxiomPositions returns the file-entry name spans.
      var byName = {};
      try {
        var grammar = this.getGrammar();
        var map     = grammar.collectAxiomPositions(pomText);
        var posMap  = map.pomFileName || {};
        for ( var name in posMap ) {
          var p = posMap[name];
          if ( byName[name] !== undefined ) continue;
          byName[name] = { line: p.line, character: p.col };
        }
      } catch (e) {
        // Grammar failed (mid-edit pom). Leave cache empty rather than
        // fall back — navigation just doesn't fire until the POM parses.
      }
      return byName;
    },

    function extractLIBMethodNames_(methodsArr) {
      /** Names from foam.LIB methods — supports bare functions and {name, code} objects. */
      if ( ! methodsArr || ! Array.isArray(methodsArr) ) return [];
      var names = [];
      for ( var i = 0 ; i < methodsArr.length ; i++ ) {
        var m = methodsArr[i];
        var name = '';
        if ( typeof m === 'function' ) {
          name = m.name || '';
        } else if ( m && typeof m === 'object' ) {
          name = m.name || (m.code && typeof m.code === 'function' ? m.code.name : '') || '';
        }
        if ( name ) names.push(name);
      }
      return names;
    },

    function extractLIBConstantNames_(constants) {
      /** Names from foam.LIB constants — array of {name, ...} or plain object map. */
      if ( ! constants ) return [];
      if ( Array.isArray(constants) ) {
        var names = [];
        for ( var i = 0 ; i < constants.length ; i++ ) {
          var c = constants[i];
          if ( c && c.name ) names.push(c.name);
        }
        return names;
      }
      if ( typeof constants === 'object' ) return Object.keys(constants);
      return [];
    },

    function walkSkippedProjects_(pom, path_, fs_, visited) {
      /**
       * Re-read a POM file from disk to find projects that were skipped
       * during boot (e.g., test/pom with flags: 'test'). Walk them
       * recursively to index their files too.
       *
       * Uses a minimal foam.POM interceptor via eval to capture the
       * projects/files arrays as real JS objects — this handles nested
       * metadata, computed flags, and template literals correctly.
       */
      var pomPath = pom.path;
      if ( ! pomPath || visited[pomPath] ) return;
      visited[pomPath] = true;

      try {
        var content = fs_.readFileSync(pomPath, 'utf8');
        var location = pom.location || path_.dirname(pomPath);
        var projects = this.parsePomProjects_(content);
        if ( ! projects ) return;

        for ( var p = 0 ; p < projects.length ; p++ ) {
          var proj = projects[p];
          var projName  = typeof proj === 'string' ? proj : (proj && proj.name) || '';
          var projFlags = (proj && typeof proj === 'object' && proj.flags) || '';
          if ( ! projName ) continue;

          var projPomPath = path_.resolve(location, projName + '.js');
          var alreadyLoaded = foam.poms.some(function(p) { return p.path === projPomPath; });
          if ( alreadyLoaded ) continue;
          if ( ! fs_.existsSync(projPomPath) ) continue;

          try {
            var projContent = fs_.readFileSync(projPomPath, 'utf8');
            var projLocation = path_.dirname(projPomPath);
            var projFiles = this.parsePomFiles_(projContent);

            if ( projFiles ) {
              for ( var f = 0 ; f < projFiles.length ; f++ ) {
                var file = projFiles[f];
                if ( ! file || ! file.name ) continue;
                var rawFlags = file.flags || '';
                var fileFlags = rawFlags ? rawFlags.split('|').map(function(s) {
                  return s.split('&');
                }).reduce(function(a, b) { return a.concat(b); }, []) : [];
                if ( projFlags ) fileFlags = fileFlags.concat(projFlags.split('|').map(function(s) {
                  return s.split('&');
                }).reduce(function(a, b) { return a.concat(b); }, []));

                var filePath = path_.resolve(projLocation, file.name + '.js');
                this.indexFileClasses_(filePath, fileFlags, projPomPath, file.name, fs_);
              }
            }

            var subPom = { path: projPomPath, location: projLocation };
            this.walkSkippedProjects_(subPom, path_, fs_, visited);
          } catch (e) {}
        }
      } catch (e) {}
    },

    function parsePomProjects_(content) {
      /**
       * Eval the POM text with a minimal foam.POM interceptor to capture the
       * projects array as a real JS object. Eval is complete and safe over
       * arbitrary POM contents — no regex needed for well-formed POMs.
       */
      var captured = null;
      try {
        var ctx = { foam: { POM: function(m) { captured = m.projects || null; } } };
        with ( ctx ) { eval(content); }
      } catch ( e ) {}
      return captured;
    },

    function parsePomFiles_(content) {
      /**
       * Eval the POM text with a minimal foam.POM interceptor to capture the
       * files array as real JS objects.
       */
      var captured = null;
      try {
        var ctx = { foam: { POM: function(m) { captured = m.files || null; } } };
        with ( ctx ) { eval(content); }
      } catch ( e ) {}
      return captured;
    },

    function getFilePath(classId) {
      if ( ! this.fileIndex_ ) this.buildFileIndex();
      var entry = this.fileIndex_[classId];
      return entry ? entry.path : null;
    },

    function getFileFlags(classId) {
      /** Returns the flags array for a class, or null if unknown. */
      if ( ! this.fileIndex_ ) this.buildFileIndex();
      var entry = this.fileIndex_[classId];
      return entry ? entry.flags : null;
    },

    function matchesActiveFlags(classId) {
      /** Check if a class's flags match the currently active FOAM flags. */
      var fileFlags = this.getFileFlags(classId);
      if ( ! fileFlags ) return false;
      // A file matches if any of its OR-clause flags are all satisfied
      return foam.checkFlags(foam.adaptFlags(fileFlags.join('|')));
    },

    function getAllPropertiesForFile(classId, fileText) {
      /**
       * Get ALL properties available on a class including:
       * 1. Own + inherited properties from the class hierarchy
       * 2. Properties from implements: interfaces (e.g., CreatedByAware)
       * 3. Properties from the refines: target class
       *
       * fileText: the raw file text — used via eval-intercept to read the
       * model's own implements and refines arrays directly. Falls back to
       * runtime-only when fileText isn't provided.
       */
      var propNames = {};

      var props = this.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) {
        propNames[props[i].name.toLowerCase()] = props[i];
      }

      if ( ! fileText ) return propNames;

      var models = [];
      try {
        models = foam.parse.lsp.FileModelCache.create().parseFileModels(fileText);
      } catch ( e ) { return propNames; }

      for ( var mi = 0 ; mi < models.length ; mi++ ) {
        var m = models[mi];
        var ownId = m.package ? m.package + '.' + m.name : m.name;
        if ( ownId !== classId && m.refines !== classId ) continue;

        var impls = m.implements || [];
        for ( var ii = 0 ; ii < impls.length ; ii++ ) {
          var ifaceId = typeof impls[ii] === 'string' ? impls[ii] : (impls[ii] && impls[ii].path);
          if ( ! ifaceId ) continue;
          var ifaceProps = this.getProperties(ifaceId);
          for ( var ip = 0 ; ip < ifaceProps.length ; ip++ ) {
            propNames[ifaceProps[ip].name.toLowerCase()] = ifaceProps[ip];
          }
        }
        if ( m.refines ) {
          var refProps = this.getProperties(m.refines);
          for ( var rp = 0 ; rp < refProps.length ; rp++ ) {
            propNames[refProps[rp].name.toLowerCase()] = refProps[rp];
          }
        }
      }

      return propNames;
    },

    function getOwnProperties(classId) {
      var cls = this.getClass(classId);
      if ( ! cls ) return [];
      return cls.getOwnAxiomsByClass(foam.lang.Property);
    },

    function getInheritedProperties(classId) {
      var cls = this.getClass(classId);
      if ( ! cls ) return [];
      var own = {};
      var ownProps = cls.getOwnAxiomsByClass(foam.lang.Property);
      for ( var i = 0 ; i < ownProps.length ; i++ ) own[ownProps[i].name] = true;
      var allProps = cls.getAxiomsByClass(foam.lang.Property);
      var groups = {};
      for ( var i = 0 ; i < allProps.length ; i++ ) {
        var p = allProps[i];
        if ( own[p.name] ) continue;
        var source = this.findPropertySource_(cls, p.name);
        if ( ! groups[source] ) groups[source] = [];
        groups[source].push(p);
      }
      var result = [];
      for ( var className in groups ) {
        result.push({ className: className, properties: groups[className] });
      }
      return result;
    },

    function findPropertySource_(cls, propName) {
      var parent = cls.model_.extends ? this.getClass(cls.model_.extends) : null;
      while ( parent ) {
        var ownProps = parent.getOwnAxiomsByClass(foam.lang.Property);
        for ( var i = 0 ; i < ownProps.length ; i++ ) {
          if ( ownProps[i].name === propName ) return parent.id;
        }
        parent = parent.model_.extends ? this.getClass(parent.model_.extends) : null;
      }
      return 'foam.lang.FObject';
    },

    function getJavaImportMappings() {
      return {
        'foam.core.FObject':       'foam.lang.FObject',
        'foam.core.PropertyInfo':  'foam.lang.PropertyInfo',
        'foam.core.X':             'foam.lang.X',
        'foam.core.Serializable':  'foam.lang.Serializable',
        'foam.nanos.logger.Logger':       'foam.core.logger.Logger',
        'foam.nanos.auth.LifecycleState': 'foam.core.auth.LifecycleState',
        'foam.nanos.approval.ValidationException': 'foam.lang.ValidationException'
      };
    },

    function getPropertyJavaType(classId, propName) {
      var cls = this.getClass(classId);
      if ( ! cls ) return null;
      var prop = cls.getAxiomByName(propName);
      if ( ! prop ) return null;
      var typeMap = {
        'String': 'String', 'Int': 'int', 'Long': 'long', 'Float': 'float',
        'Double': 'double', 'Boolean': 'boolean', 'Date': 'java.util.Date',
        'DateTime': 'java.util.Date', 'DateTimeUTC': 'java.util.Date',
        'Enum': 'Enum', 'Object': 'Object', 'Array': 'Object[]',
        'FObjectProperty': prop.of || 'FObject', 'Reference': 'Object'
      };
      var propType = prop.cls_ && prop.cls_.model_ ? prop.cls_.model_.name : 'Property';
      return typeMap[propType] || 'Object';
    },

    function getLibFilePath(libName) {
      /** File path for a foam.LIB by name, or null if unknown. */
      if ( ! this.libIndex_ ) this.buildFileIndex();
      var entry = this.libIndex_[libName];
      return entry ? entry.path : null;
    },

    function getLibEntry(libName) {
      /** Full LIB entry { path, line, methods, constants } or null. */
      if ( ! this.libIndex_ ) this.buildFileIndex();
      return this.libIndex_[libName] || null;
    },

    function getLibMemberNames(libName) {
      /** Combined list of method + constant names for a LIB. */
      var entry = this.getLibEntry(libName);
      if ( ! entry ) return [];
      return (entry.methods || []).concat(entry.constants || []);
    },

    function getAllLibNames() {
      /** All indexed foam.LIB names, sorted. */
      if ( ! this.libIndex_ ) this.buildFileIndex();
      return Object.keys(this.libIndex_).sort();
    },

    function findLibByPrefix(prefix) {
      /** LIB names starting with `prefix` (e.g., 'foam.'). */
      var all = this.getAllLibNames();
      var out = [];
      for ( var i = 0 ; i < all.length ; i++ ) {
        if ( all[i].indexOf(prefix) === 0 ) out.push(all[i]);
      }
      return out;
    },

    function resolvePropertyTypeClassId(classId, propName) {
      /**
       * Resolve a property's type to a FOAM class ID for chain walking.
       * Returns the class ID if the property is an FObjectProperty with of:,
       * a Reference with of:, or an Enum with of:. Returns null otherwise.
       */
      var cls = this.getClass(classId);
      if ( ! cls ) return null;
      var prop = cls.getAxiomByName(propName);
      if ( ! prop ) return null;

      if ( prop.of ) {
        var ofId = typeof prop.of === 'string' ? prop.of :
                   (prop.of.id || prop.of.name || null);
        if ( ofId && this.classExists(ofId) ) return ofId;
      }

      return null;
    },

    // ----- Workspace symbol index -----------------------------------------
    //
    // Flat array of every class / property / method / action / listener /
    // enum-value in the workspace, lazy-built and cached. Lets
    // WorkspaceSymbolHandler answer "find by name" across all kinds, not
    // just class ids. Uses cls.getOwnAxiomsByClass — no rescan, no regex.

    function buildSymbolIndex_() {
      if ( this.symbolIndex_ ) return this.symbolIndex_;
      var out  = [];
      var ids  = this.getAllClassIds();
      var self = this;

      function push(name, kind, classId) {
        if ( ! name ) return;
        out.push({
          name:          name,
          kind:          kind,
          classId:       classId,
          containerName: classId,
          filePath:      self.getFilePath(classId)
        });
      }

      for ( var i = 0 ; i < ids.length ; i++ ) {
        var id  = ids[i];
        var cls = this.getClass(id);

        // Class itself (kind: 5=Class, 11=Interface, 10=Enum)
        var kind = 5;
        try {
          if ( this.isInterface(id) )                                kind = 11;
          else if ( cls && cls.VALUES && cls.VALUES.length >= 0 )    kind = 10;
        } catch (e) {}
        push(id.split('.').pop(), kind, id);

        if ( ! cls ) continue;

        try {
          var props = cls.getOwnAxiomsByClass(foam.lang.Property);
          for ( var j = 0 ; j < props.length ; j++ ) push(props[j].name, 7, id);

          var methods = cls.getOwnAxiomsByClass(foam.lang.Method);
          for ( var j = 0 ; j < methods.length ; j++ ) push(methods[j].name, 6, id);

          if ( foam.lang.Action ) {
            var actions = cls.getOwnAxiomsByClass(foam.lang.Action);
            for ( var j = 0 ; j < actions.length ; j++ ) push(actions[j].name, 24, id);
          }
          if ( foam.lang.Listener ) {
            var listeners = cls.getOwnAxiomsByClass(foam.lang.Listener);
            for ( var j = 0 ; j < listeners.length ; j++ ) push(listeners[j].name, 24, id);
          }
          if ( cls.VALUES && cls.VALUES.length > 0 ) {
            for ( var j = 0 ; j < cls.VALUES.length ; j++ ) push(cls.VALUES[j].name, 22, id);
          }
        } catch (e) {
          // tolerate the occasional badly-shaped class without aborting the
          // whole index build
        }
      }

      this.symbolIndex_ = out;
      return out;
    },

    function searchSymbols(query, opts) {
      /**
       * Substring + ranking search over the workspace symbol index.
       *
       * @param query — case-insensitive substring. Empty string returns the
       *   first `limit` entries (caller asked for "all").
       * @param opts.limit         — default 500 (was 100 in the inline impl).
       * @param opts.kind          — optional LSP SymbolKind filter (5/6/7/...).
       * @param opts.packagePrefix — optional class-id prefix filter
       *   (e.g. "foam.u2." narrows to UI classes).
       *
       * Returns array of { name, kind, classId, filePath, containerName, score }.
       */
      opts = opts || {};
      var limit         = opts.limit || 500;
      var kindFilter    = opts.kind;
      var packagePrefix = opts.packagePrefix;
      var q             = (query || '').toLowerCase();

      var symbols = this.buildSymbolIndex_();
      var scored  = [];

      for ( var i = 0 ; i < symbols.length ; i++ ) {
        var s = symbols[i];
        if ( ! s.filePath )                                      continue;
        if ( kindFilter    && s.kind !== kindFilter )            continue;
        if ( packagePrefix && s.classId.indexOf(packagePrefix) !== 0 ) continue;

        if ( ! q ) {
          scored.push({ s: s, score: 1 });
          continue;
        }

        var name = s.name.toLowerCase();
        var score = 0;

        if ( name === q )                       score = 1000;
        else if ( name.indexOf(q) === 0 )       score = 700 - (name.length - q.length);
        else if ( this.camelHumpMatch_(s.name, query) ) score = 500;
        else if ( name.indexOf(q) !== -1 )      score = 300 - name.indexOf(q);

        if ( score > 0 ) scored.push({ s: s, score: score });
      }

      scored.sort(function(a, b) {
        if ( b.score !== a.score ) return b.score - a.score;
        return a.s.name.length - b.s.name.length;
      });

      return scored.slice(0, limit).map(function(e) {
        return {
          name:          e.s.name,
          kind:          e.s.kind,
          classId:       e.s.classId,
          containerName: e.s.containerName,
          filePath:      e.s.filePath,
          score:         e.score
        };
      });
    },

    function camelHumpMatch_(name, query) {
      // Each query character must match an uppercase letter (or first char) of
      // name in order. e.g. "FUC" matches "FileUploadConfig".
      if ( ! query ) return false;
      var humps = name.replace(/([a-z0-9])([A-Z])/g, '$1$2').split('')
        .map(function(h) { return h.charAt(0).toUpperCase(); }).join('');
      // Compare ignoring case: collapse query to upper to match generated humps
      var Q = query.toUpperCase();
      var j = 0;
      for ( var i = 0 ; i < humps.length && j < Q.length ; i++ ) {
        if ( humps[i] === Q[j] ) j++;
      }
      return j === Q.length;
    },

    function invalidateSymbolIndex_() {
      // Called by reindexFile when a class is re-registered. Lazy-rebuild on
      // next searchSymbols call. Cheap to drop, expensive to incrementally
      // patch — for a small win in correctness we trade a small cost in
      // workspace-symbol latency right after a save.
      this.symbolIndex_        = null;
      this.usageIndex_         = null;
      this.javaUsageIndex_     = null;
      this.stringUsageIndex_   = null;
      this.memberUsageIndex_   = null;
      this.viewSpecUsageIndex_ = null;
      // FoamClassGrammar bakes class ids into its parser at build time —
      // adding or removing a class invalidates the alt() list, so drop the
      // cached instance too.
      this.grammar_          = null;
    },

    function invalidatePomCache(pomFile) {
      /** Drop a single pom.js's cached entry positions. Called by the server
       *  when a pom.js is saved — the cache is keyed by pom path, so a
       *  surgical delete keeps other poms hot. Passing no argument clears
       *  every pom (full reset). */
      if ( ! this.pomEntryLineCache_ ) return;
      if ( pomFile ) delete this.pomEntryLineCache_[pomFile];
      else this.pomEntryLineCache_ = null;
    },

    // ----- JS usage index -------------------------------------------------
    //
    // For every model in the registry, walk axioms that hold JavaScript
    // function bodies (methods, actions, listeners, property functions,
    // templates, init/initE) and extract `this.<ShortName>.` references.
    // Resolve each short name through the source class's requires axiom
    // (no regex over the file text — we use the captured model). The
    // result is a `targetClassId → [{ sourceClassId, kind, axiomName }]`
    // map answering "where in JS code is this class used?".
    //
    // Coarse line precision for now (file-level via getFilePath). The
    // call-hierarchy handler refines to per-method offsets where it needs
    // them.

    function getJsUsages(classId) {
      /** Return [{ sourceClassId, axiomName, kind }] referencing classId in JS. */
      if ( ! this.usageIndex_ ) this.buildUsageIndex_();
      return this.usageIndex_.byTarget[classId] || [];
    },

    function buildUsageIndex_() {
      var byTarget = {};
      var ids      = this.getAllClassIds();
      var self     = this;

      function record(target, source, axiomName, kind) {
        if ( ! target ) return;
        var arr = byTarget[target] || (byTarget[target] = []);
        // Dedup by source+axiom+kind so listing's twice doesn't double-count.
        for ( var k = 0 ; k < arr.length ; k++ ) {
          if ( arr[k].sourceClassId === source && arr[k].axiomName === axiomName && arr[k].kind === kind ) return;
        }
        arr.push({ sourceClassId: source, axiomName: axiomName, kind: kind });
      }

      // Pattern: `this.<CapitalIdent>` — short name to resolve via requires.
      var THIS_SHORT = /\bthis\.([A-Z][\w$]*)\b/g;

      for ( var i = 0 ; i < ids.length ; i++ ) {
        var sourceId = ids[i];
        var cls      = this.getClass(sourceId);
        if ( ! cls || ! cls.model_ ) continue;

        // requires: build short→full map from the model axiom
        var shortMap = {};
        var reqs = cls.model_.requires || [];
        for ( var r = 0 ; r < reqs.length ; r++ ) {
          var req = reqs[r];
          if ( typeof req === 'string' ) {
            var parts = req.split(/\s+as\s+/);
            var path  = parts[0].trim();
            var alias = (parts[1] || path.split('.').pop()).trim();
            shortMap[alias] = path;
          } else if ( req && req.path ) {
            shortMap[req.name || req.path.split('.').pop()] = req.path;
          }
        }
        if ( Object.keys(shortMap).length === 0 ) continue;

        // For each function-bearing axiom on the class, scan its source.
        self.scanFunctions_(cls, function(src, axiomName) {
          THIS_SHORT.lastIndex = 0;
          var m;
          while ( ( m = THIS_SHORT.exec(src) ) !== null ) {
            var shortName = m[1];
            var fullId    = shortMap[shortName];
            if ( ! fullId ) continue;
            if ( ! self.classExists(fullId) ) continue;
            record(fullId, sourceId, axiomName, 'usage-js');
          }
        });
      }

      this.usageIndex_ = { byTarget: byTarget };
    },

    // ----- View-spec usage index --------------------------------------------
    //
    // For every model in the registry, walk own property axioms and scan the
    // values stored on them (instance_, post-adapt) for spec-object class
    // references: `view: { class: 'X' }`, `searchView`, `rowView`,
    // `defaultNewItem`, nested specs (`views: [{ class: 'X' }]`), and any
    // other slot holding a `{ class: '<dotted.id>' }` object. ViewSpec.adapt
    // converts the string form to the object form at set time, so the object
    // shape is the only one stored. Answers "which classes reference X only
    // inside a view spec?" — those declare no requires/of for X, so no other
    // index produces the edge and find-references never scans their files.

    function getViewSpecUsers(classId) {
      /** Return [{ sourceClassId, axiomName }] referencing classId inside axiom spec values. */
      if ( ! this.viewSpecUsageIndex_ ) this.buildViewSpecUsageIndex_();
      return this.viewSpecUsageIndex_.byTarget[classId] || [];
    },

    function buildViewSpecUsageIndex_() {
      var byTarget = {};
      var self     = this;
      var ids      = this.getAllClassIds();

      function record(target, source, axiomName) {
        var arr = byTarget[target] || (byTarget[target] = []);
        for ( var k = 0 ; k < arr.length ; k++ ) {
          if ( arr[k].sourceClassId === source && arr[k].axiomName === axiomName ) return;
        }
        arr.push({ sourceClassId: source, axiomName: axiomName });
      }

      // Only dotted ids count — bare short names ('String', 'Long') are
      // property types, already navigable through the propEntry/class path.
      // Recursion is restricted to PLAIN objects/arrays: spec literals stay
      // plain after ViewSpec.adapt, while FObject instances and other exotic
      // values carry getters whose evaluation can throw (e.g. DOM access in
      // a node process) or fire factories.
      function isPlain(v) {
        var proto = Object.getPrototypeOf(v);
        return proto === Object.prototype || proto === null;
      }

      function scanValue(v, source, axiomName, depth) {
        if ( depth > 4 || ! v ) return;
        if ( Array.isArray(v) ) {
          for ( var i = 0 ; i < v.length ; i++ ) scanValue(v[i], source, axiomName, depth + 1);
          return;
        }
        if ( typeof v !== 'object' || ! isPlain(v) ) return;
        if ( typeof v.class === 'string' && v.class.indexOf('.') !== -1 &&
             self.classExists(v.class) ) {
          record(v.class, source, axiomName);
        }
        for ( var key in v ) {
          var inner = v[key];
          if ( inner && typeof inner === 'object' ) scanValue(inner, source, axiomName, depth + 1);
        }
      }

      var PropertyClass = foam.maybeLookup('foam.lang.Property');
      if ( PropertyClass ) {
        for ( var i = 0 ; i < ids.length ; i++ ) {
          var sourceId = ids[i];
          var props;
          try {
            var cls = this.getClass(sourceId);
            props = cls && cls.getOwnAxiomsByClass(PropertyClass);
          } catch ( e ) {}
          if ( ! props ) continue;
          // Per-property catch: one axiom whose stored value misbehaves must
          // not hide the spec edges of its siblings.
          for ( var j = 0 ; j < props.length ; j++ ) {
            try {
              var p     = props[j];
              var store = p.instance_;
              if ( ! store ) continue;
              for ( var f in store ) {
                var val = store[f];
                if ( val && typeof val === 'object' ) scanValue(val, sourceId, p.name, 0);
              }
            } catch ( e ) {}
          }
        }
      }

      this.viewSpecUsageIndex_ = { byTarget: byTarget };
    },

    // ----- Member-reference index -----------------------------------------
    //
    // Per-class, per-member view of `this.X` reads inside the class's own
    // function bodies. Answers "where in this class is property
    // `clearingIdentifier` read?" without scanning unrelated files.
    //
    // The index reuses scanFunctions_'s per-axiom walk so we don't pay a
    // second registry traversal — it just records a different shape of
    // edges. Member names are resolved against the class's own + inherited
    // properties and methods (FOAM's getAxiomsByClass — no regex).

    function getMemberUsages(classId, memberName) {
      if ( ! this.memberUsageIndex_ ) this.buildMemberUsageIndex_();
      var byMember = this.memberUsageIndex_.byClass[classId];
      if ( ! byMember ) return [];
      return byMember[memberName] || [];
    },

    function buildMemberUsageIndex_() {
      var byClass = {};
      var self    = this;
      var THIS_X  = /\bthis\.(\w+)\b/g;

      var ids = this.getAllClassIds();
      for ( var i = 0 ; i < ids.length ; i++ ) {
        var classId = ids[i];
        var cls     = this.getClass(classId);
        if ( ! cls ) continue;

        // Names that count as "members" — own + inherited, props + methods.
        var memberNames = {};
        try {
          var props = cls.getAxiomsByClass(foam.lang.Property);
          for ( var p = 0 ; p < props.length ; p++ ) {
            if ( typeof props[p].name === 'string' ) memberNames[props[p].name] = 'property';
          }
        } catch (e) {}
        try {
          var methods = cls.getAxiomsByClass(foam.lang.Method);
          for ( var m = 0 ; m < methods.length ; m++ ) {
            if ( typeof methods[m].name === 'string' ) memberNames[methods[m].name] = 'method';
          }
        } catch (e) {}
        if ( Object.keys(memberNames).length === 0 ) continue;

        // Use Object.create(null) so member names like `constructor` or
        // `__proto__` can't collide with Object.prototype slots.
        var byMember = byClass[classId] || (byClass[classId] = Object.create(null));

        self.scanFunctions_(cls, function(src, axiomName) {
          THIS_X.lastIndex = 0;
          var seenInBlock = Object.create(null);
          var match;
          while ( ( match = THIS_X.exec(src) ) !== null ) {
            var name = match[1];
            if ( ! memberNames[name] ) continue;
            var key = axiomName + '|' + name;
            if ( seenInBlock[key] ) continue;
            seenInBlock[key] = true;
            if ( ! Array.isArray(byMember[name]) ) byMember[name] = [];
            byMember[name].push({
              axiomName:  axiomName,
              memberKind: memberNames[name],
              kind:       'usage-member'
            });
          }
        });
      }

      this.memberUsageIndex_ = { byClass: byClass };
    },

    // ----- String reference index -----------------------------------------
    //
    // FOAM lets one class declare names via `exports:` and others receive
    // them via `imports:`. The names are plain strings, but they form a
    // real reference graph callers need to follow:
    //
    //   exports: ['currentUser', 'pushMenu']    // ApplicationController
    //   imports: ['pushMenu']                    // MyView ← uses currentUser
    //
    // Same shape applies to DAO names registered as CSpecs in services.jrl
    // files — `imports: ['userDAO']` is satisfied by a CSpec entry whose
    // `id` is `userDAO` somewhere in the workspace.
    //
    // The string-reference index walks every class's exports/imports axioms
    // and every services.jrl file (via JrlLoader, the FOAM-native journal
    // reader), then answers `getStringUsages(name)` — every class that
    // imports the name + every services.jrl entry that registers it.

    function getStringUsages(name) {
      if ( ! this.stringUsageIndex_ ) this.buildStringUsageIndex_();
      return this.stringUsageIndex_.byName[name] || [];
    },

    function buildStringUsageIndex_() {
      var byName = {};
      var self   = this;

      function record(name, entry) {
        if ( typeof name !== 'string' || ! name ) return;
        // Strip the `?` optional-marker that FOAM allows on import names.
        name = name.replace(/\?$/, '');
        var arr = byName[name] || (byName[name] = []);
        for ( var k = 0 ; k < arr.length ; k++ ) {
          if ( arr[k].sourceClassId === entry.sourceClassId &&
               arr[k].axiomName     === entry.axiomName &&
               arr[k].kind          === entry.kind ) return;
        }
        arr.push(entry);
      }

      // 1. Imports / exports on every class — read via FOAM axiom APIs.
      var ids = this.getAllClassIds();
      for ( var i = 0 ; i < ids.length ; i++ ) {
        var classId = ids[i];
        var cls     = this.getClass(classId);
        if ( ! cls ) continue;

        try {
          var imports = cls.getOwnAxiomsByClass(foam.lang.Import);
          for ( var j = 0 ; j < imports.length ; j++ ) {
            var imp = imports[j];
            if ( typeof imp.key !== 'string' && typeof imp.name !== 'string' ) continue;
            // Import key falls back to name (FOAM's standard pattern).
            var key = imp.key || imp.name;
            record(key, {
              sourceClassId: classId,
              axiomName:     'imports.' + imp.name,
              kind:          'usage-string'
            });
          }
        } catch (e) {}

        try {
          var exports = cls.getOwnAxiomsByClass(foam.lang.Export);
          for ( var j = 0 ; j < exports.length ; j++ ) {
            var exp = exports[j];
            if ( typeof exp.exportName !== 'string' && typeof exp.name !== 'string' ) continue;
            var name = exp.exportName || exp.name;
            record(name, {
              sourceClassId: classId,
              axiomName:     'exports.' + exp.name,
              kind:          'export'
            });
          }
        } catch (e) {}
      }

      // 2. CSpec entries in every services.jrl walked via JrlLoader (the
      // FOAM-native reader). Each registered service gets a 'cspec' entry
      // keyed by its id — matched against import keys above.
      try {
        var jrlLoader = foam.parse.lsp.JrlLoader.create();
        var fs_       = require('fs');
        var path_     = require('path');
        var fileIndex = this.fileIndex_ || {};
        var seenDirs  = {};
        var services  = [];
        for ( var id in fileIndex ) {
          var entry = fileIndex[id];
          var p     = typeof entry === 'string' ? entry : entry.path;
          if ( ! p ) continue;
          var dir = path_.dirname(p);
          if ( seenDirs[dir] ) continue;
          seenDirs[dir] = true;
          var svc = path_.join(dir, 'services.jrl');
          if ( fs_.existsSync(svc) ) services.push(svc);
        }
        for ( var s = 0 ; s < services.length ; s++ ) {
          try {
            var entries = jrlLoader.loadFile(services[s]);
            for ( var e = 0 ; e < entries.length ; e++ ) {
              var ent = entries[e];
              if ( ! ent || typeof ent.id !== 'string' ) continue;
              record(ent.id, {
                sourceClassId: null,
                axiomName:     'services.jrl',
                kind:          'cspec',
                file:          services[s]
              });
            }
          } catch (e) {}
        }
      } catch (e) {}

      this.stringUsageIndex_ = { byName: byName };
    },

    // ----- Java usage index -----------------------------------------------
    //
    // FOAM captures every javaCode / javaPostSet / javaFactory / etc. block
    // as a string on the model object. We don't need to invoke the Java
    // parser — a single regex over capitalised identifiers, resolved
    // through the class's javaImports, gives a per-target-class index of
    // every Java-side reference. Same fact pattern as the JS usage scan,
    // different axiom slots.

    function getJavaUsages(classId) {
      if ( ! this.javaUsageIndex_ ) this.buildJavaUsageIndex_();
      return this.javaUsageIndex_.byTarget[classId] || [];
    },

    function buildJavaUsageIndex_() {
      var byTarget = {};
      var ids      = this.getAllClassIds();
      var self     = this;

      function record(target, source, axiomName) {
        if ( ! target ) return;
        var arr = byTarget[target] || (byTarget[target] = []);
        for ( var k = 0 ; k < arr.length ; k++ ) {
          if ( arr[k].sourceClassId === source && arr[k].axiomName === axiomName ) return;
        }
        arr.push({ sourceClassId: source, axiomName: axiomName, kind: 'usage-java' });
      }

      var CAP_IDENT = /\b([A-Z][\w]*(?:\.[A-Z][\w]*)*)\b/g;

      for ( var i = 0 ; i < ids.length ; i++ ) {
        var sourceId = ids[i];
        var cls      = this.getClass(sourceId);
        if ( ! cls ) continue;

        var javaImports = cls.model_ && cls.model_.javaImports || [];
        if ( javaImports.length === 0 && ! (cls.model_ && cls.model_.package) ) continue;

        var importLookup = {};
        for ( var x = 0 ; x < javaImports.length ; x++ ) {
          var imp = javaImports[x];
          if ( typeof imp !== 'string' ) continue;
          if ( imp.indexOf('*') !== -1 ) continue;
          var parts = imp.split('.');
          importLookup[parts[parts.length - 1]] = imp;
        }

        self.scanJavaBlocks_(cls, function(src, axiomName) {
          CAP_IDENT.lastIndex = 0;
          var m;
          var seenThisBlock = {};
          while ( ( m = CAP_IDENT.exec(src) ) !== null ) {
            var token = m[1];
            if ( seenThisBlock[token] ) continue;
            seenThisBlock[token] = true;

            var fullId = null;
            if ( importLookup[token] && self.classExists(importLookup[token]) ) {
              fullId = importLookup[token];
            } else if ( token.indexOf('.') !== -1 && self.classExists(token) ) {
              fullId = token;
            } else if ( cls.model_ && cls.model_.package ) {
              var candidate = cls.model_.package + '.' + token;
              if ( self.classExists(candidate) ) fullId = candidate;
            }
            if ( ! fullId || fullId === sourceId ) continue;
            record(fullId, sourceId, axiomName);
          }
        });
      }

      this.javaUsageIndex_ = { byTarget: byTarget };
    },

    function scanJavaBlocks_(cls, visit) {
      // Visit `visit(javaString, axiomName)` for every Java-bearing slot on
      // a FOAM class. Walks via FOAM's axiom APIs (getOwnAxiomsByClass)
      // first — that's the canonical way to read Method / Property axioms.
      // When the runtime boots without Java refinements (some test contexts),
      // the axioms drop `javaCode`/`javaPostSet`/etc.; fall back to the raw
      // input on cls.model_ so the scanner still works.
      function emit(name, val) {
        if ( typeof val === 'string' && val.length > 0 ) visit(val, name);
      }

      var model = cls && cls.model_ || {};

      // Top-level javaCode on the class.
      emit('javaCode', model.javaCode);

      // Methods — prefer Method axioms, fall back to model.methods raw input.
      var methodAxioms = [];
      try { methodAxioms = cls.getOwnAxiomsByClass(foam.lang.Method); } catch (e) {}
      var rawMethods = model.methods || [];
      var seenMethodNames = {};
      for ( var i = 0 ; i < methodAxioms.length ; i++ ) {
        var ax = methodAxioms[i];
        var name = ax.name;
        seenMethodNames[name] = true;
        if ( typeof ax.javaCode === 'string' && ax.javaCode.length > 0 ) {
          emit('methods.' + name + '.javaCode', ax.javaCode);
        } else {
          // Axiom missing javaCode (no Java refinements loaded) — pull from raw input
          for ( var j = 0 ; j < rawMethods.length ; j++ ) {
            var rm = rawMethods[j];
            if ( rm && typeof rm === 'object' && rm.name === name && typeof rm.javaCode === 'string' ) {
              emit('methods.' + name + '.javaCode', rm.javaCode);
              break;
            }
          }
        }
      }
      // Pick up any raw-method entries whose Method axiom didn't materialise
      // (anonymous functions don't always become axioms). Defensive on the
      // name type — refinement metadata occasionally produces Symbol-typed
      // names on raw entries.
      for ( var j = 0 ; j < rawMethods.length ; j++ ) {
        var rm = rawMethods[j];
        if ( ! rm || typeof rm !== 'object' || typeof rm.name !== 'string' ) continue;
        if ( seenMethodNames[rm.name] ) continue;
        if ( typeof rm.javaCode === 'string' ) {
          emit('methods.' + rm.name + '.javaCode', rm.javaCode);
        }
      }

      // Properties — same pattern. Kept in sync with the known-keys list in
      // CursorAnalyzer.getBacktickBlockContext, MINUS the slots that FOAM's
      // Property refinement implements via `expression:` (javaValue and
      // javaValidateObj). Reading those triggers asJavaValue, which throws
      // when the underlying value can't be lowered to Java — fine for code
      // generation, fatal for a passive scan over every Property in the
      // registry.
      var javaPropSlots = [
        'javaCode',      'javaPreSet',  'javaPostSet',   'javaFactory',
        'javaGetter',    'javaSetter',  'javaAdapt',     'javaCompare',
        'javaAssertValue', 'javaInit',  'javaToCSV',     'javaToCSVLabel',
        'javaQueryParser', 'javaJSONParser', 'javaCSVParser',
        'javaCloneProperty', 'javaDiffProperty', 'javaFormatJSON',
        'javaCondition',
        'javaComparePropertyToObject', 'javaComparePropertyToValue',
        'javaFromCSVLabelMapping'
      ];
      var propAxioms = [];
      try { propAxioms = cls.getOwnAxiomsByClass(foam.lang.Property); } catch (e) {}
      var seenPropNames = {};
      for ( var p = 0 ; p < propAxioms.length ; p++ ) {
        var pax = propAxioms[p];
        if ( typeof pax.name !== 'string' ) continue;
        seenPropNames[pax.name] = true;
        for ( var s = 0 ; s < javaPropSlots.length ; s++ ) {
          var slot = javaPropSlots[s];
          // Defensive try/catch: even non-expression slots can fault when
          // the underlying axiom is partially built.
          try {
            var v = pax[slot];
            if ( typeof v === 'string' && v.length > 0 ) {
              emit('properties.' + pax.name + '.' + slot, v);
            }
          } catch (e) {}
        }
      }
    },

    function scanFunctions_(cls, visit) {
      // Visit `visit(sourceString, axiomName)` for every JS function on the
      // class. Reads axioms via FOAM's getOwnAxiomsByClass — Method, Action,
      // Listener axioms expose `.code` as the live function. Property axioms
      // expose `factory` / `expression` / `preSet` / etc. Falls back to
      // model.<slot>[] raw input when an axiom has no `.code` (rare —
      // anonymous-function entries that don't materialise as axioms).
      function srcOf(v) {
        if ( ! v )                                       return '';
        if ( typeof v === 'function' )                   return v.toString();
        if ( typeof v === 'string' )                     return v;
        if ( typeof v === 'object' && typeof v.code === 'function' ) return v.code.toString();
        return '';
      }

      var axiomGroups = [
        { axiomClass: foam.lang.Method,   modelKey: 'methods',   label: 'methods'   },
        { axiomClass: foam.lang.Listener, modelKey: 'listeners', label: 'listeners' }
      ];
      if ( foam.lang.Action ) {
        axiomGroups.push({ axiomClass: foam.lang.Action, modelKey: 'actions', label: 'actions' });
      }

      var model = cls && cls.model_ || {};

      // Methods, listeners, actions — FOAM axiom path first.
      for ( var g = 0 ; g < axiomGroups.length ; g++ ) {
        var grp = axiomGroups[g];
        var seen = {};
        var axioms = [];
        try { axioms = cls.getOwnAxiomsByClass(grp.axiomClass); } catch (e) {}
        for ( var i = 0 ; i < axioms.length ; i++ ) {
          var ax  = axioms[i];
          var src = srcOf(ax.code);
          if ( src ) visit(src, grp.label + '.' + ax.name);
          seen[ax.name] = true;
        }
        // Fallback for raw entries not materialised as axioms (rare).
        var rawArr = model[grp.modelKey];
        if ( ! Array.isArray(rawArr) ) continue;
        for ( var i = 0 ; i < rawArr.length ; i++ ) {
          var item = rawArr[i];
          var name = (item && item.name) || null;
          // Defensive: with Java refinements loaded, some raw entries carry
          // Symbol-typed `name` slots that confuse string concat.
          if ( typeof name !== 'string' ) continue;
          if ( ! name || seen[name] ) continue;
          var src = typeof item === 'function' ? item.toString() : srcOf(item.code);
          if ( src ) visit(src, grp.label + '.' + name);
        }
      }

      // Templates — keep raw-array walk; no dedicated axiom class.
      var templates = model.templates || [];
      for ( var i = 0 ; i < templates.length ; i++ ) {
        var t = templates[i];
        if ( ! t || typeof t !== 'object' ) continue;
        var name = t.name || '(anonymous)';
        var src  = srcOf(t.code);
        if ( src ) visit(src, 'templates.' + name);
      }

      // Lifecycle hooks live on the model itself.
      var lifecycle = ['init', 'initE', 'installInClass', 'installInProto'];
      for ( var s = 0 ; s < lifecycle.length ; s++ ) {
        var src = srcOf(model[lifecycle[s]]);
        if ( src ) visit(src, lifecycle[s]);
      }

      // Property functions — Property axiom path first.
      var propFnSlots = ['factory', 'expression', 'preSet', 'postSet', 'value',
                         'view', 'tableCellFormatter', 'labelFormatter',
                         'assertValue', 'adapt'];
      var propAxioms  = [];
      try { propAxioms = cls.getOwnAxiomsByClass(foam.lang.Property); } catch (e) {}
      var seenProp = {};
      for ( var p = 0 ; p < propAxioms.length ; p++ ) {
        var pax = propAxioms[p];
        seenProp[pax.name] = true;
        for ( var s = 0 ; s < propFnSlots.length ; s++ ) {
          var src = srcOf(pax[propFnSlots[s]]);
          if ( src ) visit(src, 'properties.' + pax.name + '.' + propFnSlots[s]);
        }
      }
      var rawProps = model.properties || [];
      for ( var p = 0 ; p < rawProps.length ; p++ ) {
        var rp = rawProps[p];
        if ( ! rp || typeof rp !== 'object' || ! rp.name ) continue;
        if ( seenProp[rp.name] ) continue;
        for ( var s = 0 ; s < propFnSlots.length ; s++ ) {
          var src = srcOf(rp[propFnSlots[s]]);
          if ( src ) visit(src, 'properties.' + rp.name + '.' + propFnSlots[s]);
        }
      }
    }
  ]
});
