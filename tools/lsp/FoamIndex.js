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
      /** Index all files from a POM, storing flag metadata per class. */
      var location = pom.location || '';
      var files = pom.files || [];

      for ( var f = 0 ; f < files.length ; f++ ) {
        var file = files[f];
        var filePath = path_.resolve(location, file.name + '.js');
        var fileFlags = file.flags ? String(file.flags).split('|').map(function(s) {
          return s.split('&');
        }).reduce(function(a, b) { return a.concat(b); }, []) : ['js'];

        this.indexFileClasses_(filePath, fileFlags, fs_);
      }
    },

    function indexFileClasses_(filePath, fileFlags, fs_) {
      /** Read a file and extract all foam.CLASS/ENUM/INTERFACE class IDs via regex.
       *  Uses regex (not eval) for speed — scanning 4000+ files at startup. */
      try {
        if ( ! fs_.existsSync(filePath) ) return;
        var content = fs_.readFileSync(filePath, 'utf8');
        var callRegex = /foam\.(CLASS|ENUM|INTERFACE)\s*\(/g;
        var callMatch;
        while ( ( callMatch = callRegex.exec(content) ) !== null ) {
          var snippet = content.substring(callMatch.index, callMatch.index + 500);
          var pkgM = snippet.match(/package\s*:\s*['"]([^'"]+)['"]/);
          var nameM = snippet.match(/name\s*:\s*['"]([^'"]+)['"]/);
          if ( nameM ) {
            var classId = pkgM ? pkgM[1] + '.' + nameM[1] : nameM[1];
            this.fileIndex_[classId] = { path: filePath, flags: fileFlags };
          }
        }
      } catch (e) {}
    },

    function walkSkippedProjects_(pom, path_, fs_, visited) {
      /**
       * Re-read a POM file from disk to find projects that were skipped
       * during boot (e.g., test/pom with flags: 'test'). Walk them
       * recursively to index their files too.
       */
      var pomPath = pom.path;
      if ( ! pomPath || visited[pomPath] ) return;
      visited[pomPath] = true;

      try {
        var content = fs_.readFileSync(pomPath, 'utf8');
        // Find projects: [...] in the POM source
        var projectsMatch = content.match(/projects\s*:\s*\[([\s\S]*?)\]/);
        if ( ! projectsMatch ) return;

        var location = pom.location || require('path').dirname(pomPath);

        // Extract project entries: { name: 'test/pom', flags: 'test' }
        var projRegex = /\{\s*name\s*:\s*['"]([^'"]+)['"](?:\s*,\s*flags\s*:\s*['"]([^'"]+)['"])?\s*\}/g;
        var pm;
        while ( ( pm = projRegex.exec(projectsMatch[1]) ) !== null ) {
          var projName = pm[1];
          var projFlags = pm[2] || '';

          // Check if this project was already loaded (in foam.poms)
          var projPomPath = path_.resolve(location, projName + '.js');
          var alreadyLoaded = foam.poms.some(function(p) { return p.path === projPomPath; });
          if ( alreadyLoaded ) continue;

          // This project was skipped — read its POM and index its files
          if ( ! fs_.existsSync(projPomPath) ) continue;
          try {
            var projContent = fs_.readFileSync(projPomPath, 'utf8');
            var projLocation = path_.dirname(projPomPath);

            // Extract files from the skipped POM
            var filesMatch = projContent.match(/files\s*:\s*\[([\s\S]*?)\]/);
            if ( filesMatch ) {
              var fileRegex = /\{\s*name\s*:\s*['"]([^'"]+)['"](?:\s*,\s*flags\s*:\s*['"]([^'"]+)['"])?\s*\}/g;
              var fm;
              while ( ( fm = fileRegex.exec(filesMatch[1]) ) !== null ) {
                var fileName = fm[1];
                var fileFlags = fm[2] ? fm[2].split('|').map(function(s) {
                  return s.split('&');
                }).reduce(function(a, b) { return a.concat(b); }, []) : [];
                // Add the project's own flags
                if ( projFlags ) fileFlags = fileFlags.concat(projFlags.split('|').map(function(s) {
                  return s.split('&');
                }).reduce(function(a, b) { return a.concat(b); }, []));

                var filePath = path_.resolve(projLocation, fileName + '.js');
                this.indexFileClasses_(filePath, fileFlags, fs_);
              }
            }

            // Recursively walk this POM's sub-projects
            var subPom = { path: projPomPath, location: projLocation };
            this.walkSkippedProjects_(subPom, path_, fs_, visited);
          } catch (e) {}
        }
      } catch (e) {}
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
       * fileText: the raw file text — used to parse implements/refines
       * since those may reference classes not yet resolved.
       */
      var propNames = {};

      // Class own + inherited properties
      var props = this.getProperties(classId);
      for ( var i = 0 ; i < props.length ; i++ ) {
        propNames[props[i].name.toLowerCase()] = props[i];
      }

      if ( fileText ) {
        // Implements interfaces
        var implMatch = fileText.match(/implements\s*:\s*\[([\s\S]*?)\]/);
        if ( implMatch ) {
          var ifaceRegex = /['"]([^'"]+)['"]/g;
          var ifm;
          while ( ( ifm = ifaceRegex.exec(implMatch[1]) ) !== null ) {
            var ifaceProps = this.getProperties(ifm[1]);
            for ( var ip = 0 ; ip < ifaceProps.length ; ip++ ) {
              propNames[ifaceProps[ip].name.toLowerCase()] = ifaceProps[ip];
            }
          }
        }

        // Refines target
        var refMatch = fileText.match(/refines\s*:\s*['"]([^'"]+)['"]/);
        if ( refMatch ) {
          var refProps = this.getProperties(refMatch[1]);
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
    }
  ]
});
