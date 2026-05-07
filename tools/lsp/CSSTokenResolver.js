/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp',
  name: 'CSSTokenResolver',

  documentation: `Loads CSS tokens from the FOAM registry (foam.u2.CSSTokens) and parses
    cssTokenOverrides.jrl and themes.jrl journals. Resolves $-references
    recursively. Provides multi-theme lookup for hover content.`,

  requires: [
    'foam.parse.lsp.JrlLoader'
  ],

  properties: [
    {
      name: 'tokenMap_',
      documentation: `Map of tokenName to
        { default_: { value, resolved }, themes: { themeId: { value, resolved } },
          variants: { variantName: { value, resolved } }, type, source }`,
      factory: function() { return {}; }
    },
    {
      name: 'themeNames_',
      documentation: 'Map of themeId to display name.',
      factory: function() { return {}; }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.JrlLoader',
      name: 'jrlLoader',
      factory: function() { return this.JrlLoader.create(); }
    }
  ],

  methods: [
    function loadFromRegistry() {
      /**
       * Load CSS tokens from EVERY class in the FOAM registry that declares
       * `cssTokens:` — not just `foam.u2.CSSTokens`. Walks the live axioms
       * via `getOwnAxiomsByClass(CSSToken)` so each entry preserves its
       * class (CSSToken vs ColorToken), variants, and function-valued
       * `value` (LIGHTEN/FOREGROUND/etc.) — none of which survive in raw
       * `model_.cssTokens` data.
       *
       * Resolution is delegated to `foam.CSS.returnTokenValue` so color
       * tokens resolve through the same machinery as the runtime — LIGHTEN
       * and FOREGROUND modifiers, function values, theme overrides — instead
       * of the simple `$ref` chain handled by `resolve_()`. We still keep
       * `resolve_()` as a fallback when foam.CSS isn't available.
       *
       * Token-name collisions (same name in two classes) take last-write
       * with `foam.u2.CSSTokens` winning when present, since it owns the
       * project-wide design system.
       */
      var CSSTokenCls = foam.maybeLookup('foam.u2.CSSToken');
      if ( ! CSSTokenCls ) return;

      var cache = foam.__context__.__cache__;

      // Collect (sourceCls, axiom) pairs by walking each class's own
      // properties — not just `getOwnAxiomsByClass(CSSToken)`. ColorToken
      // installs synthetic suffix axioms (`$hover`, `$active`, `$disabled`,
      // `$foreground` and combos) via `Object.defineProperty` getters that
      // don't appear in the axiom registry. Iterating the class's own
      // properties and checking each for `CSSToken.isInstance` picks up
      // the directly-declared tokens AND the ColorToken-installed suffix
      // tokens uniformly — so future framework additions land here for
      // free without us re-listing suffixes.
      //
      // Sorted so foam.u2.CSSTokens lands last and its tokens overwrite
      // any per-class duplicates.
      var entries = [];
      for ( var key in cache ) {
        if ( key.indexOf('.') === -1 ) continue;     // skip short names
        var cls = foam.maybeLookup(key);
        if ( ! cls ) continue;

        // Only walk classes that actually declare cssTokens — avoids the
        // expensive enumeration on the bulk of the registry, and the
        // synthetic-suffix axioms only ever live on those classes.
        if ( ! cls.model_ || ! cls.model_.cssTokens || ! cls.model_.cssTokens.length ) continue;

        var names;
        try { names = Object.getOwnPropertyNames(cls); } catch ( e ) { continue; }
        for ( var i = 0 ; i < names.length ; i++ ) {
          var ax;
          try { ax = cls[names[i]]; } catch ( e ) { continue; }
          if ( ! ax || ! CSSTokenCls.isInstance(ax) ) continue;
          entries.push({ sourceCls: cls, axiom: ax });
        }
      }

      entries.sort(function(a, b) {
        var aRoot = a.sourceCls.id === 'foam.u2.CSSTokens' ? 1 : 0;
        var bRoot = b.sourceCls.id === 'foam.u2.CSSTokens' ? 1 : 0;
        return aRoot - bRoot;
      });

      for ( var i = 0 ; i < entries.length ; i++ ) {
        this.installAxiom_(entries[i].axiom, entries[i].sourceCls);
      }

      // Resolve $-references / function values across the merged map. Uses
      // foam.CSS.returnTokenValue per token (which respects the source
      // class context) and falls back to the legacy resolver otherwise.
      var ctx = foam.__context__;
      for ( var name in this.tokenMap_ ) {
        if ( ! this.tokenMap_.hasOwnProperty(name) ) continue;
        var entry = this.tokenMap_[name];

        entry.default_.resolved = this.resolveTokenViaCss_(name, entry, ctx)
                              || this.resolve_(entry.default_.value);

        for ( var vk in entry.variants ) {
          if ( ! entry.variants.hasOwnProperty(vk) ) continue;
          entry.variants[vk].resolved = this.resolve_(entry.variants[vk].value);
        }
      }
    },

    function installAxiom_(axiom, sourceCls) {
      /** Convert one CSSToken/ColorToken axiom into a tokenMap_ entry. */
      if ( ! axiom || ! axiom.name ) return;

      var rawValue = axiom.value;
      // Function values (LIGHTEN/FOREGROUND/etc.) — store the source repr
      // for hover display. The actual resolved value comes from foam.CSS.
      var displayValue = typeof rawValue === 'function'
        ? this.functionValueRepr_(rawValue)
        : ( rawValue || '' );

      var entry = {
        default_: { value: displayValue, resolved: null },
        themes:   {},
        variants: {},
        type:     ( axiom.cls_ && axiom.cls_.id === 'foam.u2.ColorToken' )
                    ? 'ColorToken' : 'CSSToken',
        source:   sourceCls.id
      };

      if ( axiom.variants ) {
        for ( var vk in axiom.variants ) {
          if ( ! axiom.variants.hasOwnProperty(vk) ) continue;
          var v = axiom.variants[vk];
          var vv = v && typeof v.value === 'function'
            ? this.functionValueRepr_(v.value)
            : ( v && v.value || '' );
          entry.variants[vk] = { value: vv, resolved: null };
        }
      }

      this.tokenMap_[axiom.name] = entry;
    },

    function functionValueRepr_(fn) {
      /**
       * Render a function-valued token as a short string for hover/display.
       * Tries to detect LIGHTEN/FOREGROUND modifiers from the function body —
       * good enough for surfacing intent without evaluating the function.
       */
      try {
        var src = fn.toString();
        var m = src.match(/e\.(LIGHTEN|FOREGROUND|DARKEN)\s*\(/);
        if ( m ) return m[1] + '(...)';
        return 'function(...)';
      } catch ( e ) {
        return 'function(...)';
      }
    },

    function resolveTokenViaCss_(tokenName, entry, ctx) {
      /**
       * Use foam.CSS.returnTokenValue with the token's source class. Pass
       * the source class so per-class tokens (Button.TAB_ACTIVE_COLOR etc.)
       * resolve correctly — findTokenAxiom checks the passed class first
       * before falling back to foam.u2.CSSTokens.
       *
       * Returns the resolved string, or null if foam.CSS is unavailable
       * or the call returned the input unchanged.
       */
      if ( ! ( foam.CSS && foam.CSS.returnTokenValue ) ) return null;
      var sourceCls = entry && entry.source ? foam.maybeLookup(entry.source) : null;
      try {
        var ret = foam.CSS.returnTokenValue('$' + tokenName, sourceCls || null, ctx);
        if ( ret && ret !== '$' + tokenName && ret.indexOf('/* failed') === -1 ) {
          return ret;
        }
      } catch ( e ) {}
      return null;
    },

    function loadFromJournals() {
      /**
       * Parse themes.jrl for theme IDs/names and cssTokenOverrides.jrl
       * for per-theme token overrides using JrlLoader. Resolves $-references
       * after loading.
       */
      var fs_, path_;
      try {
        fs_ = require('fs');
        path_ = require('path');
      } catch ( e ) {
        return;
      }

      var root = this.findProjectRoot_(path_);
      if ( ! root ) return;

      // Collect theme JRL file paths
      var themeFiles = [
        path_.join(root, 'journals', 'themes.jrl'),
        path_.join(root, 'foam3', 'src', 'foam', 'core', 'theme', 'themes.jrl')
      ];

      // Also check deployment directories
      var deployDir = path_.join(root, 'deployment');
      try {
        if ( fs_.existsSync(deployDir) ) {
          var deployDirs = fs_.readdirSync(deployDir);
          for ( var i = 0 ; i < deployDirs.length ; i++ ) {
            var tf = path_.join(deployDir, deployDirs[i], 'themes.jrl');
            if ( fs_.existsSync(tf) ) themeFiles.push(tf);
          }
        }
      } catch ( e ) {}

      // Load theme objects via JrlLoader and extract id/name
      for ( var i = 0 ; i < themeFiles.length ; i++ ) {
        var objects = this.jrlLoader.loadFile(themeFiles[i]);
        for ( var j = 0 ; j < objects.length ; j++ ) {
          var obj = objects[j];
          if ( obj.id && obj.name ) {
            this.themeNames_[obj.id] = obj.name;
          }
        }
      }

      // Load CSS token overrides via JrlLoader
      var overrideFile = path_.join(root, 'journals', 'cssTokenOverrides.jrl');
      var overrides = this.jrlLoader.loadFile(overrideFile);
      for ( var i = 0 ; i < overrides.length ; i++ ) {
        var obj = overrides[i];
        if ( ! obj.theme || ! obj.source || ! obj.target ) continue;

        var source = obj.source;

        // Ensure token entry exists
        if ( ! this.tokenMap_[source] ) {
          this.tokenMap_[source] = {
            default_: { value: '', resolved: '' },
            themes: {},
            variants: {},
            type: null,
            source: 'cssTokenOverrides.jrl'
          };
        }

        this.tokenMap_[source].themes[obj.theme] = {
          value: obj.target,
          resolved: null
        };
      }

      // Resolve all theme override $-references
      for ( var name in this.tokenMap_ ) {
        if ( ! this.tokenMap_.hasOwnProperty(name) ) continue;
        var themes = this.tokenMap_[name].themes;
        for ( var themeId in themes ) {
          if ( themes.hasOwnProperty(themeId) ) {
            themes[themeId].resolved = this.resolve_(themes[themeId].value, themeId);
          }
        }
      }
    },

    function findProjectRoot_(path_) {
      /** Walk up from cwd looking for pom.js or foam3/ directory. */
      var fs = require('fs');
      var dir = process.cwd();
      for ( var depth = 0 ; depth < 20 ; depth++ ) {
        if ( fs.existsSync(path_.join(dir, 'pom.js')) ||
             fs.existsSync(path_.join(dir, 'foam3')) ) {
          return dir;
        }
        var parent = path_.dirname(dir);
        if ( parent === dir ) break;
        dir = parent;
      }
      return null;
    },

    function resolve_(value, opt_themeId, opt_depth) {
      /**
       * Recursively resolve $-references.
       * @param value The value to resolve (may start with $).
       * @param opt_themeId Optional theme ID for theme-specific resolution.
       * @param opt_depth Recursion depth for loop protection (max 10).
       * @returns The resolved value.
       */
      if ( ! value || typeof value !== 'string' || value.charAt(0) !== '$' ) {
        return value;
      }

      var depth = opt_depth || 0;
      if ( depth >= 10 ) return value;

      var tokenName = value.substring(1);
      var entry = this.tokenMap_[tokenName];
      if ( ! entry ) return value;

      // If theme specified, check theme override first
      if ( opt_themeId && entry.themes[opt_themeId] ) {
        var themeVal = entry.themes[opt_themeId].value;
        return this.resolve_(themeVal, opt_themeId, depth + 1);
      }

      // Follow default chain
      return this.resolve_(entry.default_.value, opt_themeId, depth + 1);
    },

    function getAllTokenNames() {
      /** Returns sorted array of all token names. */
      return Object.keys(this.tokenMap_).sort();
    },

    function tokenExists(name) {
      /** Returns true if the token name exists in the map. */
      return !! this.tokenMap_[name];
    },

    function getTokenInfo(name) {
      /** Returns the full token info object or null. */
      return this.tokenMap_[name] || null;
    },

    function getResolvedValue(name, opt_themeId) {
      /**
       * Get the resolved value for a token, optionally per-theme.
       * @param name Token name (without $).
       * @param opt_themeId Optional theme ID.
       * @returns The resolved CSS value string or null.
       */
      var entry = this.tokenMap_[name];
      if ( ! entry ) return null;

      if ( opt_themeId && entry.themes[opt_themeId] ) {
        if ( entry.themes[opt_themeId].resolved ) {
          return entry.themes[opt_themeId].resolved;
        }
        return this.resolve_(entry.themes[opt_themeId].value, opt_themeId);
      }

      return entry.default_.resolved || entry.default_.value;
    },

    function findTokenForValue(cssValue) {
      /**
       * Reverse-lookup: return the ColorToken name whose resolved value
       * matches `cssValue` (normalized, case-insensitive). Returns null
       * if no match. Used by the "raw color → $token" code-action fix.
       */
      if ( ! cssValue ) return null;
      var needle = this.normalizeColor_(cssValue);
      if ( ! needle ) return null;
      var names = this.getAllTokenNames();
      for ( var i = 0 ; i < names.length ; i++ ) {
        var info = this.getTokenInfo(names[i]);
        if ( ! info || info.type !== 'ColorToken' ) continue;
        var resolved = this.resolveTokenValue(names[i]);
        if ( ! resolved ) continue;
        if ( this.normalizeColor_(resolved) === needle ) return names[i];
      }
      return null;
    },

    function normalizeColor_(v) {
      /** Normalize to lowercase 6-digit hex when possible; else lowercased trimmed. */
      if ( ! v ) return null;
      var s = v.trim().toLowerCase();
      var m = s.match(/^#([0-9a-f]{3})$/);
      if ( m ) {
        var c = m[1];
        return '#' + c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      }
      if ( /^#[0-9a-f]{6}$/.test(s) ) return s;
      if ( /^#[0-9a-f]{8}$/.test(s) ) return s;
      return s;
    },

    function resolveTokenValue(tokenName) {
      /**
       * Resolve a token to its final CSS value using foam.CSS.returnTokenValue.
       * Passes the token's source class (e.g., Button for tabActiveColor) so
       * findTokenAxiom looks at the right place. Falls back to internal
       * resolution if foam.CSS is unavailable or the call doesn't reduce.
       * @param tokenName Token name without $ prefix.
       * @returns Resolved CSS value string or null if token unknown.
       */
      var entry = this.tokenMap_[tokenName];
      if ( ! entry ) return null;

      var ret = this.resolveTokenViaCss_(tokenName, entry, foam.__context__);
      if ( ret ) return ret;

      // Fallback to internal resolution
      return this.getResolvedValue(tokenName);
    },

    function colorSwatch_(hexColor) {
      /**
       * Returns an inline markdown image of a colored square using an SVG data URI.
       * Works in VS Code hover markdown. Returns empty string for non-hex values.
       */
      if ( ! hexColor || typeof hexColor !== 'string' ) return '';
      // Only render swatches for hex colors
      var hex = hexColor.match(/^#([0-9a-fA-F]{3,8})$/);
      if ( ! hex ) return '';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">'
        + '<rect width="12" height="12" rx="2" fill="' + hexColor + '" stroke="%23888" stroke-width="1"/>'
        + '</svg>';
      var encoded = svg.replace(/#/g, '%23').replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/ /g, '%20');
      return '![](data:image/svg+xml,' + encoded + ')';
    },

    function buildHoverContent(tokenName) {
      /**
       * Build markdown hover content with multi-theme resolution table
       * and inline color swatches for hex values.
       */
      var entry = this.tokenMap_[tokenName];
      if ( ! entry ) return null;

      var typeName = entry.type ? entry.type.replace(/^foam\.u2\./, '') : '';
      var defaultResolved = entry.default_.resolved || entry.default_.value;
      var swatch = this.colorSwatch_(defaultResolved);

      var md = swatch + (swatch ? ' ' : '') + '**$' + tokenName + '**';
      if ( typeName ) md += ' (' + typeName + ')';
      md += '\n\n';

      // Theme resolution table
      md += '| Theme | Value | Resolved | |\n';
      md += '|-------|-------|----------|---|\n';

      // Default row
      md += '| Default | `' + entry.default_.value + '` | `' + defaultResolved + '` | '
        + this.colorSwatch_(defaultResolved) + ' |\n';

      // Theme override rows
      for ( var themeId in entry.themes ) {
        if ( ! entry.themes.hasOwnProperty(themeId) ) continue;
        var theme = entry.themes[themeId];
        var displayName = this.themeNames_[themeId] || themeId;
        var resolved = theme.resolved || this.resolve_(theme.value, themeId);
        md += '| ' + displayName + ' | `' + theme.value + '` | `' + resolved + '` | '
          + this.colorSwatch_(resolved) + ' |\n';
      }

      // Variants section
      var variantKeys = Object.keys(entry.variants);
      if ( variantKeys.length > 0 ) {
        md += '\n**Variants:**\n';
        for ( var i = 0 ; i < variantKeys.length ; i++ ) {
          var vk = variantKeys[i];
          var v = entry.variants[vk];
          var resolvedV = v.resolved || this.resolve_(v.value);
          var vSwatch = this.colorSwatch_(resolvedV);
          md += '- ' + vk + ': `' + v.value + '`';
          if ( v.value !== resolvedV ) md += ' → `' + resolvedV + '`';
          if ( vSwatch ) md += ' ' + vSwatch;
          md += '\n';
        }
      }

      // Source
      md += '\nDefined in `' + entry.source + '`\n';

      return md;
    }
  ]
});
