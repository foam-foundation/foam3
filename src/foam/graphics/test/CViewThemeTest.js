/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graphics.test',
  name: 'CViewThemeTest',
  extends: 'foam.core.test.JSTest',

  requires: [ 'foam.graphics.CViewTheme' ],

  documentation: 'A missing token resolves loudly (magenta / default font), a present one resolves to its value.',

  methods: [
    async function runTest(x) {
      var t = this.CViewTheme.create({ colors: { ink: '#123456' }, fonts: { label: 'bold 11px sans-serif' } });
      x.test(t.resolve('ink') === '#123456',            'present color token resolves');
      x.test(t.resolve('nope') === 'magenta',            'missing color token resolves to magenta, not black');
      x.test(t.font('label') === 'bold 11px sans-serif', 'present font token resolves');
      x.test(t.font('nope') === '12px sans-serif',       'missing font token resolves to the default font');
      x.test(t.background === '',                        'no background by default');

      var empty = this.CViewTheme.create();
      x.test(empty.resolve('anything') === 'magenta',    'an empty theme still resolves loudly');
    }
  ]
});
