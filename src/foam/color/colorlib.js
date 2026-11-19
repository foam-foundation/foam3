/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.Color',

  constants: [
    {
      name: 'NAME_TO_COLOR',
      value: {
        black: "#000000",
        navy: "#000080",
        darkblue: "#00008b",
        mediumblue: "#0000cd",
        blue: "#0000ff",
        darkgreen: "#006400",
        green: "#008000",
        teal: "#008080",
        darkcyan: "#008b8b",
        deepskyblue: "#00bfff",
        darkturquoise: "#00ced1",
        mediumspringgreen: "#00fa9a",
        lime: "#00ff00",
        springgreen: "#00ff7f",
        aqua: "#00ffff",
        cyan: "#00ffff",
        midnightblue: "#191970",
        dodgerblue: "#1e90ff",
        lightseagreen: "#20b2aa",
        forestgreen: "#228b22",
        seagreen: "#2e8b57",
        darkslategray: "#2f4f4f",
        darkslategrey: "#2f4f4f",
        limegreen: "#32cd32",
        mediumseagreen: "#3cb371",
        turquoise: "#40e0d0",
        royalblue: "#4169e1",
        steelblue: "#4682b4",
        darkslateblue: "#483d8b",
        mediumturquoise: "#48d1cc",
        indigo: "#4b0082",
        darkolivegreen: "#556b2f",
        cadetblue: "#5f9ea0",
        cornflowerblue: "#6495ed",
        rebeccapurple: "#663399",
        mediumaquamarine: "#66cdaa",
        dimgray: "#696969",
        dimgrey: "#696969",
        slateblue: "#6a5acd",
        olivedrab: "#6b8e23",
        slategray: "#708090",
        slategrey: "#708090",
        lightslategray: "#778899",
        lightslategrey: "#778899",
        mediumslateblue: "#7b68ee",
        lawngreen: "#7cfc00",
        chartreuse: "#7fff00",
        aquamarine: "#7fffd4",
        maroon: "#800000",
        purple: "#800080",
        olive: "#808000",
        gray: "#808080",
        grey: "#808080",
        skyblue: "#87ceeb",
        lightskyblue: "#87cefa",
        blueviolet: "#8a2be2",
        darkred: "#8b0000",
        darkmagenta: "#8b008b",
        saddlebrown: "#8b4513",
        darkseagreen: "#8fbc8f",
        lightgreen: "#90ee90",
        mediumpurple: "#9370db",
        darkviolet: "#9400d3",
        palegreen: "#98fb98",
        darkorchid: "#9932cc",
        yellowgreen: "#9acd32",
        sienna: "#a0522d",
        brown: "#a52a2a",
        darkgray: "#a9a9a9",
        darkgrey: "#a9a9a9",
        lightblue: "#add8e6",
        greenyellow: "#adff2f",
        paleturquoise: "#afeeee",
        lightsteelblue: "#b0c4de",
        powderblue: "#b0e0e6",
        firebrick: "#b22222",
        darkgoldenrod: "#b8860b",
        mediumorchid: "#ba55d3",
        rosybrown: "#bc8f8f",
        darkkhaki: "#bdb76b",
        silver: "#c0c0c0",
        mediumvioletred: "#c71585",
        indianred: "#cd5c5c",
        peru: "#cd853f",
        chocolate: "#d2691e",
        tan: "#d2b48c",
        lightgray: "#d3d3d3",
        lightgrey: "#d3d3d3",
        thistle: "#d8bfd8",
        orchid: "#da70d6",
        goldenrod: "#daa520",
        palevioletred: "#db7093",
        crimson: "#dc143c",
        gainsboro: "#dcdcdc",
        plum: "#dda0dd",
        burlywood: "#deb887",
        lightcyan: "#e0ffff",
        lavender: "#e6e6fa",
        darksalmon: "#e9967a",
        violet: "#ee82ee",
        palegoldenrod: "#eee8aa",
        lightcoral: "#f08080",
        khaki: "#f0e68c",
        aliceblue: "#f0f8ff",
        honeydew: "#f0fff0",
        azure: "#f0ffff",
        sandybrown: "#f4a460",
        wheat: "#f5deb3",
        beige: "#f5f5dc",
        whitesmoke: "#f5f5f5",
        mintcream: "#f5fffa",
        ghostwhite: "#f8f8ff",
        salmon: "#fa8072",
        antiquewhite: "#faebd7",
        linen: "#faf0e6",
        lightgoldenrodyellow: "#fafad2",
        oldlace: "#fdf5e6",
        red: "#ff0000",
        fuchsia: "#ff00ff",
        magenta: "#ff00ff",
        deeppink: "#ff1493",
        orangered: "#ff4500",
        tomato: "#ff6347",
        hotpink: "#ff69b4",
        coral: "#ff7f50",
        darkorange: "#ff8c00",
        lightsalmon: "#ffa07a",
        orange: "#ffa500",
        lightpink: "#ffb6c1",
        pink: "#ffc0cb",
        gold: "#ffd700",
        peachpuff: "#ffdab9",
        navajowhite: "#ffdead",
        moccasin: "#ffe4b5",
        bisque: "#ffe4c4",
        mistyrose: "#ffe4e1",
        blanchedalmond: "#ffebcd",
        papayawhip: "#ffefd5",
        lavenderblush: "#fff0f5",
        seashell: "#fff5ee",
        cornsilk: "#fff8dc",
        lemonchiffon: "#fffacd",
        floralwhite: "#fffaf0",
        snow: "#fffafa",
        yellow: "#ffff00",
        lightyellow: "#ffffe0",
        ivory: "#fffff0",
        white: "#ffffff"
      },
    },
    {
      name: 'COLOR_TO_NAME',
      factory: function () {
        return Object.entries(this.NAME_TO_COLOR)
          .reduce((o, [k, v]) => (o[v] = k, o), {});
      }
    }
  ],

  methods: [
    function parse(str) {
      str = str.trim();

      if ( foam.Color.NAME_TO_COLOR.hasOwnProperty(str) ) {
        str = foam.Color.NAME_TO_COLOR[str];
      }

      var components;

      if ( str.startsWith('#') ) {
        str = str.slice(1);
        foam.assert( str.length == 6 || str.length == 8 );
        components = str.match(/../g).map(v => parseInt(v, 16));
      } else if ( str.startsWith('rgb') || str.startsWith('hsl') ) {
        // TODO: doesnt support relative colours i.e. hsl(from....)
        // CSS writes the parts with commas, or with spaces and '/ alpha'.
        var inner = str.substring(str.indexOf('(') + 1, str.length-1);
        components = ( inner.indexOf(',') != -1 ? inner.split(',') : inner.split(' ') )
          .map(v => v.trim()).filter(v => v && v != '/');
        if ( str.startsWith('hsl') ) components = foam.Color.hslToRgb(components);
      }

      return {
        red: components[0],
        green: components[1],
        blue: components[2],
        alpha: components[3]
      };
    },

    function rgbToHex(str) {
      colorObj = foam.Color.parse(str);
      var [r, g, b] = [colorObj.red, colorObj.green, colorObj.blue].map(v => Math.floor(v));
      function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
      }

      return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    },

    function rgbToGrey(rgb /*[0..255,0.255,0.255]*/) /* -> 0..1 */ {
      var [r, g, b] = rgb;
      return 0.299 * r/255 + 0.587 * g/255 + 0.114 * b/255;
    },

    function rgbToHsl(r, g, b) {
      r /= 255, g /= 255, b /= 255;
    
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h, s, l = (max + min) / 2;
    
      if (max == min) {
        h = s = 0; // achromatic
      } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
    
        h /= 6;
      }
    
      return  [Math.floor(h * 360), Math.floor(s * 100), Math.floor(l * 100)];
    },

    function hslToRgb(args){
        let [h,s,l,a] = args
        var r, g, b;
        // Normalize arguments
        function percentageToDecimal(percentageString) {
          if ( typeof percentageString !== 'string' ) {
            return percentageString;
          } else if ( percentageString.indexOf('%') == -1 ) {
            // CSS also writes saturation and lightness as plain numbers: hsl(220 90 56).
            return Number(percentageString) / 100;
          }
          const numericalPart = percentageString.slice(0, -1);
          return parseFloat(numericalPart) / 100;
        }
        s = percentageToDecimal(s);
        l = percentageToDecimal(l)

        // CSS writes the hue in degrees ('120' or '120deg'); hueToRGB wants 0 to 1.
        h = parseFloat(h) / 360;
        h = h - Math.floor(h);

        if ( s == 0 ) {
            r = g = b = l; // achromatic
        } else {
            var hueToRGB = function(p, q, t){
              if( t < 0 ) t += 1;
              if( t > 1 ) t -= 1;
              if( t < 1/6 ) return p + (q - p) * 6 * t;
              if( t < 1/2 ) return q;
              if( t < 2/3 ) return p + (q - p) * (2/3 - t) * 6;
              return p;
            }

            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hueToRGB(p, q, h + 1/3);
            g = hueToRGB(p, q, h);
            b = hueToRGB(p, q, h - 1/3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), a];
    },
    
    function getBestForeground(str, black, white) {
      with ( foam.Color.parse(str) ) {
        return red*0.299 + green*0.587 + blue*0.114 > 186 ? black : white;
      }
    },

    function lighten(str, value) {
      colorObj = foam.Color.parse(str);
      var [r, g, b] = [colorObj.red, colorObj.green, colorObj.blue];
      let l = foam.Color.rgbToGrey([r, g, b])*1000;
      let scale;
      l = Math.max(150, l);
      if ( l > 200 ) {
       scale = l + (l*(value/100));
      } else {
        scale = l - (l*(value/100));
      }
      var [r, g, b] = foam.Color.adjustRGBBrightness([r, g, b], scale/1000);
      return `rgb(${r.toFixed(4)},${g.toFixed(4)},${b.toFixed(4)})`;
    },

   
    function fromHue(str, s, l) {
      // TODO: Fine for now but we need to normalise green/yellow hues
      // becuase they seem lighter than everything else
      colorObj = foam.Color.parse(str);
      var [r, g, b] = [colorObj.red, colorObj.green, colorObj.blue].map(v => Math.floor(v));
      var [h, _, _] = foam.Color.rgbToHsl(r, g, b);
      return `hsl(${h} ${s}% ${l}%)`;
    },

    function adjustAlpha(str, desiredOpacity /*0-1*/) {
      colorObj = foam.Color.parse(str);
      var [r, g, b, a] = [colorObj.red, colorObj.green, colorObj.blue].map(v => Math.floor(v));
      var [h, s, l] = foam.Color.rgbToHsl(r, g, b);
      return `hsla(${h} ${s}% ${l}% / ${desiredOpacity})`;
    },

    function adjustRGBBrightness(rgb /*[0..255,0.255,0.255]*/, desired/*0..1*/) {
      var [r, g, b] = rgb;
      var gr = foam.Color.rgbToGrey(rgb);
      if ( desired >= gr ) {
        var mix = (desired - gr) / ( 1 - gr);
        return [ 255 * mix + (1-mix) * r, 255 * mix + (1-mix) * g, 255 * mix + (1-mix) * b];
      }
      var scale = desired/gr;
      return [ scale * r, scale * g, scale * b ];
    },

    function randomColor( bounds /* { h/s/l: [min, max] } */ ) {
      let hue = bounds?.h ?? [0, 360];
      let sat = bounds?.s ?? [0, 100];
      let lig = bounds?.l ?? [0, 100];
      return 'hsl(' + (hue[0] +(hue[1] - hue[0]) * Math.random()) + ',' +
             (sat[0] + (sat[1] - sat[0]) * Math.random()) + '%,' + 
             (lig[0] + (lig[1] - lig[0]) * Math.random()) + '%)';
    }
  ]
});
