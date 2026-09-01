/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.agents',
  name: 'QuickAgent',

  static: [
    function getImpliedId(args) {
      return args.spec?.toSummary?.();
    }
  ],

  properties: [
    {
      class: 'Function',
      name: 'executeFn',
      transient: true,
    }
  ],

  methods: [
    async function execute(x) {
      x = x || this.__subContext__;
      return await this.executeFn(x);
    }
  ]
});
