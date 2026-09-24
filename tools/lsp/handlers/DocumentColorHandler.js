/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.lsp.handlers',
  name: 'DocumentColorHandler',

  documentation: `textDocument/documentColor + textDocument/colorPresentation.
    Puts a colour swatch next to every CSS $token inside a model's css: block
    whose resolved value is a colour, and next to raw colour literals
    (#hex, rgb()/rgba(), hsl()/hsla()) written as declaration values there.
    A token that does not resolve, or resolves to something that is not a
    colour (a size, a function value), gets no swatch and no error.

    colorPresentation never turns a token into a literal: picking a colour on
    a $token swatch answers the token's own text, so the edit the client
    applies is a no-op. The design system owns a token's value; an editor
    colour picker writing a hex over it would undo the point of the token.`,

  requires: [
    'foam.parse.lsp.FileClassifier'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FoamIndex',
      name: 'index'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.CSSTokenResolver',
      name: 'cssTokenResolver'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.parse.lsp.FileClassifier',
      name: 'fileClassifier',
      factory: function() { return this.FileClassifier.create(); }
    }
  ],

  constants: {
    // Same full-chain shape DiagnosticsHandler.validateCSS_ matches, so a
    // ColorToken suffix chain like `$primary400$hover` is one token (with one
    // swatch) rather than `$primary400` plus an unknown `$hover`.
    TOKEN_RE: /\$([a-zA-Z][a-zA-Z0-9_\-]*(?:\$[a-zA-Z][a-zA-Z0-9_\-]*)*)/g,
    LITERAL_RE: /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^()]*\)/g,
    COMMENT_RE: /\/\*[\s\S]*?\*\//g,
    // A literal inside these is text, not a colour: `fill: url(#abc)` names
    // an SVG element and `content: '#fff'` prints the characters.
    // Escape-aware, so `content: '\''` closes where the string really does.
    OPAQUE_RE: /url\([^)]*\)|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g,
    // Named colours are not swatched in general — a word like `red` inside a
    // css block is as likely an animation name as a colour. These three are
    // the ones tokens resolve to in practice.
    NAMED: {
      transparent: { red: 0, green: 0, blue: 0, alpha: 0 },
      white:       { red: 1, green: 1, blue: 1, alpha: 1 },
      black:       { red: 0, green: 0, blue: 0, alpha: 1 }
    }
  },

  methods: [
    function handle(text, uri) {
      /** ColorInformation[] for the css: blocks of a FOAM class file. */
      if ( ! text || this.fileClassifier.classify(uri, text) !== 'class' ) return [];

      var blocks = this.index.getGrammar().collectCssBlocks(text);
      if ( ! blocks.length ) return [];

      var lineStarts = this.lineStarts_(text);
      var out = [];
      for ( var i = 0 ; i < blocks.length ; i++ ) {
        this.collectBlock_(text, blocks[i], lineStarts, out);
      }
      return out;
    },

    function collectBlock_(text, block, lineStarts, out) {
      // Comments are blanked to spaces (offsets unchanged) before anything
      // else scans the block. Otherwise the apostrophe in `/* don't */` opens
      // a "string" that swallows the real `color: #ff0000;` after it, and
      // that swatch is lost.
      var css  = text.substring(block.startPos, block.endPos)
        .replace(this.COMMENT_RE, function(c) { return c.replace(/[^\n]/g, ' '); });
      var self = this;
      var push     = function(start, length, color) {
        out.push({
          range: {
            start: self.toPosition_(lineStarts, block.startPos + start),
            end:   self.toPosition_(lineStarts, block.startPos + start + length)
          },
          color: color
        });
      };

      var re = new RegExp(this.TOKEN_RE.source, 'g');
      var m;
      while ( ( m = re.exec(css) ) !== null ) {
        var color = this.tokenColor_(m[1]);
        if ( color ) push(m.index, m[0].length, color);
      }

      var opaque = this.spans_(this.OPAQUE_RE, css);
      re = new RegExp(this.LITERAL_RE.source, 'g');
      while ( ( m = re.exec(css) ) !== null ) {
        if ( this.inSpans_(opaque, m.index) ) continue;
        if ( ! this.isDeclarationValue_(css, m.index, m[0].length) ) continue;
        var lit = this.parseColor(m[0]);
        if ( lit ) push(m.index, m[0].length, lit);
      }
    },

    function tokenColor_(name) {
      if ( ! this.cssTokenResolver ) return null;
      var value;
      try {
        value = this.cssTokenResolver.resolveTokenValue(name);
      } catch ( e ) {
        require('../logError').logLspError('documentColor: resolving $' + name, e);
        return null;
      }
      return value ? this.parseColor(value) : null;
    },

    function isDeclarationValue_(css, start, length) {
      /**
       * A `#abc` in a selector is an element id, not a colour: `#add { … }`
       * would otherwise get a light-blue swatch. A literal counts only when a
       * `:` sits between it and the previous `{`, `;` or `}` — it is on the
       * value side of a declaration — and no `{` follows before the next
       * `;` or `}`, which rules out `a:hover #abc {`.
       */
      var i = start - 1;
      var sawColon = false;
      for ( ; i >= 0 ; i-- ) {
        var c = css.charAt(i);
        if ( c === ':' ) sawColon = true;
        if ( c === '{' || c === ';' || c === '}' ) break;
      }
      if ( ! sawColon ) return false;
      for ( var j = start + length ; j < css.length ; j++ ) {
        var d = css.charAt(j);
        if ( d === '{' ) return false;
        if ( d === ';' || d === '}' ) return true;
      }
      return true;
    },

    function presentations(text, params) {
      /**
       * ColorPresentation[] for a picked colour. On a $token swatch the only
       * presentation is the token's own text: the client replaces the range
       * with it, which changes nothing. A raw literal gets hex, rgb and hsl
       * forms, with the form the author already used first.
       */
      if ( ! text || ! params || ! params.range ) return [];
      var current = this.rangeText_(text, params.range);
      if ( current.charAt(0) === '$' ) return [ { label: current } ];

      var c = params.color;
      if ( ! c ) return [];
      var hex = { label: this.toHex_(c) };
      var rgb = { label: this.toRgb_(c) };
      var hsl = { label: this.toHsl_(c) };
      if ( /^rgb/i.test(current) ) return [ rgb, hex, hsl ];
      if ( /^hsl/i.test(current) ) return [ hsl, hex, rgb ];
      return [ hex, rgb, hsl ];
    },

    function parseColor(value) {
      /** LSP Color ({red,green,blue,alpha}, each 0..1) for a CSS colour string, or null. */
      if ( ! value || typeof value !== 'string' ) return null;
      var s = value.trim().toLowerCase();

      if ( this.NAMED.hasOwnProperty(s) ) return Object.assign({}, this.NAMED[s]);

      var hex = s.match(/^#([0-9a-f]{3,8})$/);
      if ( hex ) {
        var h = hex[1];
        if ( h.length === 3 || h.length === 4 ) {
          h = h.split('').map(function(ch) { return ch + ch; }).join('');
        }
        if ( h.length !== 6 && h.length !== 8 ) return null;
        return {
          red:   parseInt(h.substr(0, 2), 16) / 255,
          green: parseInt(h.substr(2, 2), 16) / 255,
          blue:  parseInt(h.substr(4, 2), 16) / 255,
          alpha: h.length === 8 ? parseInt(h.substr(6, 2), 16) / 255 : 1
        };
      }

      var fn = s.match(/^(rgba?|hsla?)\(([^()]*)\)$/);
      if ( ! fn ) return null;
      // Both syntaxes: legacy `rgb(1, 2, 3, 0.5)` and modern
      // `hsla(0 0% 5% / 0.8)` — the form resolved tokens actually come in.
      var parts = fn[2].replace(/\//g, ' ').replace(/,/g, ' ').trim().split(/\s+/);
      if ( parts.length !== 3 && parts.length !== 4 ) return null;
      var alpha = parts.length === 4 ? this.channel_(parts[3], 1) : 1;
      if ( alpha === null ) return null;

      if ( fn[1].charAt(0) === 'r' ) {
        var r = this.channel_(parts[0], 255), g = this.channel_(parts[1], 255), b = this.channel_(parts[2], 255);
        if ( r === null || g === null || b === null ) return null;
        return { red: r, green: g, blue: b, alpha: alpha };
      }

      var hue = parseFloat(parts[0]);
      var sat = this.channel_(parts[1], 100), lig = this.channel_(parts[2], 100);
      if ( isNaN(hue) || sat === null || lig === null ) return null;
      var rgb = this.hslToRgb_(( ( hue % 360 ) + 360 ) % 360 / 360, sat, lig);
      return { red: rgb[0], green: rgb[1], blue: rgb[2], alpha: alpha };
    },

    function channel_(str, scale) {
      /** One channel as 0..1: `50%` is a percentage, a bare number is out of `scale`. */
      var pct = /%$/.test(str);
      var n = parseFloat(str);
      if ( isNaN(n) ) return null;
      var v = pct ? n / 100 : n / scale;
      return Math.max(0, Math.min(1, v));
    },

    function hslToRgb_(h, s, l) {
      if ( s === 0 ) return [ l, l, l ];
      var q = l < 0.5 ? l * ( 1 + s ) : l + s - l * s;
      var p = 2 * l - q;
      var f = function(t) {
        if ( t < 0 ) t += 1;
        if ( t > 1 ) t -= 1;
        if ( t < 1 / 6 ) return p + ( q - p ) * 6 * t;
        if ( t < 1 / 2 ) return q;
        if ( t < 2 / 3 ) return p + ( q - p ) * ( 2 / 3 - t ) * 6;
        return p;
      };
      return [ f(h + 1 / 3), f(h), f(h - 1 / 3) ];
    },

    function toHex_(c) {
      var two = function(v) {
        var n = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16);
        return n.length === 1 ? '0' + n : n;
      };
      var hex = '#' + two(c.red) + two(c.green) + two(c.blue);
      return c.alpha < 1 ? hex + two(c.alpha) : hex;
    },

    function toRgb_(c) {
      var ch = function(v) { return Math.round(Math.max(0, Math.min(1, v)) * 255); };
      if ( c.alpha < 1 ) {
        return 'rgba(' + ch(c.red) + ', ' + ch(c.green) + ', ' + ch(c.blue) + ', ' +
          ( Math.round(c.alpha * 100) / 100 ) + ')';
      }
      return 'rgb(' + ch(c.red) + ', ' + ch(c.green) + ', ' + ch(c.blue) + ')';
    },

    function toHsl_(c) {
      var r = c.red, g = c.green, b = c.blue;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var l = ( max + min ) / 2, h = 0, s = 0;
      if ( max !== min ) {
        var d = max - min;
        s = l > 0.5 ? d / ( 2 - max - min ) : d / ( max + min );
        h = max === r ? ( g - b ) / d + ( g < b ? 6 : 0 ) :
            max === g ? ( b - r ) / d + 2 : ( r - g ) / d + 4;
        h /= 6;
      }
      // % 360: a red just short of pure rounds its hue up to 360, the same
      // angle as 0, and `hsl(360, …)` reads as a different colour.
      var body = ( Math.round(h * 360) % 360 ) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%';
      return c.alpha < 1 ?
        'hsla(' + body + ', ' + ( Math.round(c.alpha * 100) / 100 ) + ')' :
        'hsl(' + body + ')';
    },

    function rangeText_(text, range) {
      var starts = this.lineStarts_(text);
      var a = this.toOffset_(starts, range.start), b = this.toOffset_(starts, range.end);
      return a === null || b === null || b < a ? '' : text.substring(a, b);
    },

    function spans_(re, s) {
      var out = [], r = new RegExp(re.source, 'g'), m;
      while ( ( m = r.exec(s) ) !== null ) out.push([ m.index, m.index + m[0].length ]);
      return out;
    },

    function inSpans_(spans, pos) {
      for ( var i = 0 ; i < spans.length ; i++ ) {
        if ( pos >= spans[i][0] && pos < spans[i][1] ) return true;
      }
      return false;
    },

    function lineStarts_(text) {
      var starts = [ 0 ];
      for ( var i = 0 ; i < text.length ; i++ ) {
        if ( text.charCodeAt(i) === 10 ) starts.push(i + 1);
      }
      return starts;
    },

    function toPosition_(starts, offset) {
      var lo = 0, hi = starts.length - 1;
      while ( lo < hi ) {
        var mid = ( lo + hi + 1 ) >> 1;
        if ( starts[mid] <= offset ) lo = mid; else hi = mid - 1;
      }
      return { line: lo, character: offset - starts[lo] };
    },

    function toOffset_(starts, pos) {
      if ( ! pos || pos.line < 0 || pos.line >= starts.length ) return null;
      return starts[pos.line] + pos.character;
    }
  ]
});
