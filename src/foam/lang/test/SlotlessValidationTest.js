/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.test',
  name: 'SlotlessValidationTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    getErrors() (slotless validation) must return the same result as the
    reactive errors_ getter for every validator kind, and using it must not
    break errors_ reactivity — they share the per-class validator cache.
  `,

  methods: [
    {
      name: 'runTest',
      code: function(x) {
        var P = 'foam.lang.test.slv';

        foam.CLASS({ package: P, name: 'NoValidators', properties: [ { class: 'String', name: 'a' } ] });

        foam.CLASS({ package: P, name: 'RequiredProp', properties: [
          { class: 'String', name: 'name', required: true }
        ]});

        foam.CLASS({ package: P, name: 'StrLen', properties: [
          { class: 'String', name: 'code', minLength: 2, maxLength: 4 }
        ]});

        foam.CLASS({ package: P, name: 'IntRange', properties: [
          { class: 'Int', name: 'pct', min: 0, max: 100 }
        ]});

        foam.CLASS({ package: P, name: 'FScriptVP', properties: [
          { class: 'String', name: 'email',
            validationPredicates: [ { args: ['email'], query: 'email==""||email~/@/', errorString: 'email must contain @' } ] }
        ]});

        foam.CLASS({ package: P, name: 'FnValidate', properties: [
          { class: 'String', name: 'status',
            validateObj: function(status) { if ( status === 'BAD' ) return 'status may not be BAD'; } }
        ]});

        foam.CLASS({ package: P, name: 'ArrValidate', properties: [
          { class: 'String', name: 'first' },
          { class: 'String', name: 'last',
            validateObj: [ ['first', 'last'], function(first, last) { if ( first && ! last ) return 'last required when first set'; } ] }
        ]});

        foam.CLASS({ package: P, name: 'Inner', properties: [
          { class: 'String', name: 'v', required: true }
        ]});
        foam.CLASS({ package: P, name: 'AutoVal', properties: [
          { class: 'FObjectProperty', of: P + '.Inner', name: 'inner', autoValidate: true }
        ]});

        var L = function(n) { return foam.lookup(P + '.' + n); };

        function normalize(errs) {
          if ( errs == null ) return null;
          return JSON.stringify(errs.map(function(e) { return [ e[0].name, String(e[1]) ]; })
            .sort(function(a, b) { return a[0].localeCompare(b[0]); }));
        }

        function checkSame(label, obj) {
          var a = normalize(obj.errors_);
          var b = normalize(obj.getErrors());
          x.test(a === b, label + ': getErrors() === errors_ (' + a + ' vs ' + b + ')');
        }

        // equivalence: every validator kind, valid and invalid state
        checkSame('no validators',           L('NoValidators').create({}, x));
        checkSame('required unset',          L('RequiredProp').create({}, x));
        checkSame('required set',            L('RequiredProp').create({ name: 'ok' }, x));
        checkSame('minLength violated',      L('StrLen').create({ code: 'a' }, x));
        checkSame('maxLength violated',      L('StrLen').create({ code: 'abcde' }, x));
        checkSame('length ok',               L('StrLen').create({ code: 'abc' }, x));
        checkSame('int over max',            L('IntRange').create({ pct: 150 }, x));
        checkSame('int under min',           L('IntRange').create({ pct: -1 }, x));
        checkSame('int in range',            L('IntRange').create({ pct: 50 }, x));
        checkSame('fscript invalid',         L('FScriptVP').create({ email: 'nope' }, x));
        checkSame('fscript valid',           L('FScriptVP').create({ email: 'a@b.c' }, x));
        checkSame('fn validateObj invalid',  L('FnValidate').create({ status: 'BAD' }, x));
        checkSame('fn validateObj valid',    L('FnValidate').create({ status: 'GOOD' }, x));
        checkSame('array validateObj invalid', L('ArrValidate').create({ first: 'a' }, x));
        checkSame('array validateObj valid', L('ArrValidate').create({ first: 'a', last: 'b' }, x));
        checkSame('autoValidate nested invalid', L('AutoVal').create({ inner: L('Inner').create({}, x) }, x));
        checkSame('autoValidate nested valid',   L('AutoVal').create({ inner: L('Inner').create({ v: 'ok' }, x) }, x));

        // no validators must be undefined, not an empty array
        x.test(L('NoValidators').create({}, x).getErrors() === undefined,
          'getErrors() returns undefined for a class with no validators');

        // reactivity: errors_ slot still updates after getErrors() has been used
        // (both paths share the class validator cache; getErrors first must not
        // poison slot creation)
        var r = L('RequiredProp').create({}, x);
        x.test(r.getErrors() != null, 'reactivity setup: getErrors() sees the required error');
        var slot = r.errors_$;
        x.test(slot.get() != null, 'errors_$ created after getErrors() still reports the error');
        var fired = false;
        slot.sub(function() { fired = true; });
        r.name = 'now set';
        x.test(slot.get() == null, 'errors_$ clears when the required property is set');
        x.test(fired, 'errors_$ notifies subscribers on the change');
        x.test(r.getErrors() == null, 'getErrors() agrees after the change');
        r.name = '';
        x.test(normalize(slot.get()) === normalize(r.getErrors()),
          'errors_ and getErrors() agree again after reverting to invalid');
      }
    }
  ]
});
