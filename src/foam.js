/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

(function() {
  var scripts = '';
  var FILES = [];
  var foam = globalThis.foam = Object.assign({
    setFlags: {}, // set of flags set in URL args or in POMs, used to ensure only first one is used
    defaultStage: 0,
    stages: {},
    FILES: FILES,
    CUR_FILES: FILES,
    isServer: false,
    defaultFlags: {
      dev:   true,
      debug: true,
      java:  false,
      js:    true,
      node:  false,
      swift: false,
      web:   true
    },
    setupFlags: function() {
      var flags        = globalThis.foam.flags;
      var defaultFlags = foam.defaultFlags;

      for ( var key in defaultFlags )
        if ( ! flags.hasOwnProperty(key) )
          flags[key] = defaultFlags[key];

      if ( ! globalThis.document ) return;

      // Allow flags to be set in loading script tag.
      // Ex.: <script language="javascript" src="../../../foam.js" flags="u3,-debug"></script>
      var sflags = document.currentScript.getAttribute('flags');
      if ( sflags ) {
        sflags.split(',').forEach(f => {
          if ( f.startsWith('-') ) {
            flags[f.substring(1)] = false;
          } else {
            flags[f] = true;
          }
        });
      }
    },
    setup: function() {
      foam.setupFlags();

      // set flags by url parameters
      var urlParams = new URLSearchParams(window.location.search);
      for ( var pair of urlParams.entries() ) {
        globalThis.foam.flags[pair[0]]    = (pair[1] == 'true');
        // Prevents from being overritten in POM's, URL takes precedence
        globalThis.foam.setFlags[pair[0]] = true;
      }

      var src  = document.currentScript && document.currentScript.src;
      var path = src && new URL(src).pathname || '';

      [path, globalThis.FOAM_BIN] = /^\/foam-bin(.)*\.js$/.test(path)
        ? ['/', path]
        : [path.substring(0, path.lastIndexOf('/foam.js') + 1)];

      if ( ! globalThis.FOAM_ROOT ) globalThis.FOAM_ROOT = path;

      foam.cwd = path;
      foam.main();
    },
    main: function() {
      // main() only runs when this foam.js file is added to an html page via
      // <script> tag. The <script> tag may contain project attribute to specify
      // which pom files to be loaded on startup.
      //
      // If the project pom is provided then pom.js files relative to the html
      // file will be loaded otherwise it will by default load pom.js that
      // resided in the same directory as the foam.js file.
      var poms = (document.currentScript.getAttribute("project") || globalThis.FOAM_ROOT + 'pom').split(',');

      foam.cwd = '';
      poms.forEach(pom => {
        foam.require(pom, false, true);
      });
    },
    checkFlags: function(flags) {
      if ( ! flags || flags.length == 0 ) return true;

      function and(fs) {
        if ( ! fs ) return true;
        foam.assertFlags(fs);
        fs = fs.split('&');
        for ( var i = 0 ; i < fs.length ; i++ ) {
          if ( ! foam.flags[fs[i]] ) return false;
        }
        return true;
      }

      // OR AND clauses
      for ( var i = 0 ; i < flags.length ; i++ ) {
        if ( and(flags[i]) ) return true;
      }
      return false;
    },
    require: function(fn /* filename */, batch, isProject) {
      if ( fn ) {
        fn = foam.cwd + fn;
        if ( ! isProject && foam.seen(fn) ) return;
        scripts += '<script type="text/javascript" src="' + fn + '.js"></script>\n';
      }
      if ( ! batch || isProject ) {
        document.writeln(scripts);
        scripts = '';
      }
    },
    loadJSLibs: function(libs) {
      libs && libs.forEach(f => {
        var head = document.getElementsByTagName('head').item(0);
        var s    = document.createElement('script');
        s.setAttribute('type', 'text/javascript');
        s.setAttribute('src', f.name);
        if ( f.defer ) s.setAttribute('defer', '');
        if ( f.async ) s.setAttribute('async', '');
        head.appendChild(s);
      });
    },
    flags:       {},
    loaded:      {},
    seen:        function(fn) {
      if ( foam.loaded[fn] ) {
        console.warn(`Duplicated load of '${fn}'`);
        return true;
      }
      foam.loaded[fn] = true;
      return false;
    },
    assertFlags: function(flags) {
      // A flags string/clause is WORD ( [|&] WORD )*. Whitespace or an empty
      // token ("js |java", "js||java") used to match nothing silently,
      // dropping the entry from every build with no trace. Fail the load
      // loudly at the author instead.
      if ( /\s/.test(flags) || /(^|[|&])([|&]|$)/.test(flags) ) {
        throw new Error('foam: malformed flags ' + JSON.stringify(flags) +
          " - whitespace or empty token; expected e.g. 'js|java&test'");
      }
    },
    adaptFlags: function(flags) {
      if ( typeof flags !== 'string' ) return flags;
      // '' means "no flags" — e.g. a flagless pom entry's [] joined back
      // into a string (LSP FoamIndex.matchesActiveFlags). Always matches
      // (checkFlags([]) is true), never malformed.
      if ( flags === '' ) return [];
      foam.assertFlags(flags);
      return flags.split('|');
    },
    checkForFlag: function (flags, desired) {
      if ( ! flags || ! desired ) return false;
      desired = this.adaptFlags(desired);

      function and(fs, ds) {
        foam.assertFlags(fs);
        fs = fs.split('&');
        ds = ds.split('&');
        for ( var i = 0 ; i < ds.length ; i++ )
          if ( ! fs.includes(ds[i]) )
            return false;

        return true;
      }

      // OR AND clauses
      for ( var i = 0 ; i < flags.length ; i++ )
        for ( var j = 0; j < desired.length ; j++ )
          if ( and(flags[i], desired[j]) )
            return true;

      return false;
    },
    core: {},
    util:     {
      path: function(root, path, opt_ensure) {
        var a = path.split('.');

        for ( var i = 0 ; i < a.length ; i++ ) {
          var nextRoot = root[a[i]];
          if ( nextRoot === undefined ) {
            if ( opt_ensure ) {
              nextRoot = root[a[i]] = {};
            } else {
              return;
            }
          }
          root = nextRoot;
        }

        return root;
      }
    },
    locale:   typeof navigator === 'undefined' || typeof navigator.language === 'undefined' ? 'en' : navigator.language,
    language: typeof navigator === 'undefined' || typeof navigator.language === 'undefined' ? 'en' : navigator.language.substring(0, 2),
    next$UID: (function() {
      /* Return a unique id. */
      var id = 1;
      return function next$UID() { return id++; };
    })(),
    SCRIPT: function(m) {
      m.class = '__Script__';

      // An instance of the script isn't useful at this point so just
      // execute the code. foam.SCRIPT can be overwritten later to
      // capture the details of the script if need be.

      // Only execute if the script's flags match the curren runtime flags.
      if ( foam.checkFlags(m.flags) ) {
        m.code();
        return;
      }

      m.code();
    },
    poms: [],
    checkFiles: function(files, passFnc) {
      files && files.forEach(f => {
        f.flags  = foam.adaptFlags(f.flags);

        if ( ! foam.checkFlags(f.flags) ) return;

        if ( f.predicate && ! f.predicate() ) return;

        foam.currentFlags = f.flags || [];
        // call visit function for those that pass checkFlags
        passFnc(f);
      });
    },
    POM: function(pom) {
      var FILES = foam.CUR_FILES = [];
      foam.FILES.push(FILES);
      if ( globalThis.document ) {
        var src  = document.currentScript.src;
        var i    = src.lastIndexOf('/');
        foam.cwd = src.substring(0, i+1);
      }
      pom.location = foam.cwd;
      pom.path     = foam.sourceFile;
      foam.poms.push(pom);
      function loadFiles(files, isProjects) {
        foam.checkFiles(files, function(f) {
          if ( ! isProjects ) {
//            console.log('*** FILES', f.name);
            foam.CUR_FILES.push(f.name);
          }
          foam.require(f.name, ! isProjects, isProjects);
        });
      }

      if ( pom.defaultStage != undefined ) {
        foam.defaultStage = pom.defaultStage;
      }

      if ( pom.setFlags ) {
        for ( var key in pom.setFlags ) {
          if ( foam.setFlags[key] ) {
            console.log('Not overriding flag:', key);
          } else {
            console.log('Setting flag:', key,'=', pom.setFlags[key]);
            foam.flags[key]    = pom.setFlags[key];
            // Indicate that this flag has been set so it can't be reset in
            // a future POM.
            foam.setFlags[key] = true;
          }
        }
      }

      if ( pom.stages ) {
        for ( var stage in pom.stages ) {
          pom.stages[stage].forEach(f => {
            var path = foam.cwd + '/' + f + ".js";
            foam.stages[path] = stage;
          });
        }
      }

      // TODO: requireModule vs requireFile -> require
      (foam.loadModules || loadFiles)(pom.projects, true);
      (foam.loadFiles   || loadFiles)(pom.files,    false);

      foam.require(null, false);

      foam.loadJSLibs(pom.JSLibs);
    },
    assert: console.assert.bind(console)
  }, globalThis.foam || {});

  foam.setup();
})();
