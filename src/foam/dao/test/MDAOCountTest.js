/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.test',
  name: 'MDAOCountTest',
  extends: 'foam.core.test.JSTest',

  classes: [
    {
      name: 'Counter',
      properties: [
        {
          class: 'Long',
          name: 'id'
        }
      ]
    }
  ],

  requires: [
    'foam.dao.MDAO',
    'foam.mlang.sink.Count'
  ],

  methods: [
    async function runTest(x) {
      const dao = this.MDAO.create({ of: this.Counter });
      for ( let i = 1; i <= 10; i++ ) {
        await dao.put(this.Counter.create({ id: i }));
      }

      const count = await dao.select(this.Count.create({}));
      x.test(count.value == 10, "Should count all on MDAO");

      const countSkip = await dao.skip(5).select(this.Count.create({}));
      x.test(countSkip.value == 5, "Should count on MDAO with skip");

      const countSkipAll = await dao.skip(15).select(this.Count.create({}));
      x.test(countSkipAll.value == 0, "Should count on MDAO with skip all");
    }
  ]
});
