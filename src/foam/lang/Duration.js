/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'Duration',
  extends: 'Long',

  documentation: `
    A length of time in milliseconds. Further refined in TableCellFormatter.js
    to make values human-readable when displayed in tables.
  `,

  static: [
    {
      name: 'duration',
      documentation: `
        Use the precision parameter to configure the number of units in the return string
        Use the useShort paramter to configure whether to use the short hand for time units
      `,
      code: function(value, precision = 2, useShort = true) {
        var negative = value < 0;
        value = Math.abs(value);
        // TODO: it is wrong to use 'ctrl' which may not exist
        var ts = globalThis.ctrl?.__subContext__?.translationService || { getTranslation: function(_, _, s) { return s; } };
        var values = [];
        // precision should be atleast one
        precision < 1 && ( precision = 1 );
        // initialize array of values and labels
        foam.time.TimeUnit.VALUES.forEach(unit => {
          var numUnits = Math.floor(value / unit.conversionFactorMs);
          var label = useShort ? ts.getTranslation(foam.locale, `foam.time.TimeUnit.${unit.name}.shorthand`, unit.shorthand) :
                      numUnits > 1 ? ts.getTranslation(foam.locale, `foam.time.TimeUnit.${unit.name}.plural`, unit.plural) :
                      ts.getTranslation(foam.locale, `foam.time.TimeUnit.${unit.name}.label`, unit.label);
          values.push([numUnits, label]);
          value -= numUnits * unit.conversionFactorMs;
        });

        var formatted = values.reduce((acc, cur) => {
          if ( cur[0] > 0 && precision > 0 )
            acc = acc.concat([cur[0] + cur[1]]);
          // once a nonzero value has been found, keep decrementing
          // precision even if next values are zero
          if ( acc.length ) precision--;
          return acc;
        }, []).join(' ');

        return formatted || '0ms';
      }
    }
  ]
});
