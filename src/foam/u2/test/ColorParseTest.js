/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.test',
  name: 'ColorParseTest',
  extends: 'foam.core.test.JSTest',

  documentation: 'foam.Color.parse reads an hsl() hue in degrees, as CSS writes it.',

  methods: [
    function rgb_(str) {
      var c = foam.Color.parse(str);
      return [ c.red, c.green, c.blue ].join(', ');
    },

    async function runTest(x) {
      var cases = [
        [ 'hsl(0 100% 50%)',          '255, 0, 0'   ],
        [ 'hsl(120 100% 50%)',        '0, 255, 0'   ],
        [ 'hsl(240 100% 50%)',        '0, 0, 255'   ],
        [ 'hsl(120deg 100% 50%)',     '0, 255, 0'   ],
        [ 'hsl(360 100% 50%)',        '255, 0, 0'   ],
        [ 'hsl(220, 90%, 56%)',       '42, 109, 244' ],
        [ 'hsla(220 90% 56% / 0.5)',  '42, 109, 244' ],
        [ 'hsl(0 0% 50%)',            '128, 128, 128' ]
      ];
      for ( var [ str, want ] of cases ) {
        var got = this.rgb_(str);
        x.test(got === want, `${str} is ${want}, got ${got}`);
      }
    }
  ]
});
