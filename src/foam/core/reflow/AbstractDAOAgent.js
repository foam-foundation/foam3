/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AbstractDAOAgent',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.dao.ArraySink',
    'foam.core.reflow.ErrorView'
  ],

  imports: [
    'block?',
    'dao? as referenceDAO',
    'sinkDAO as dao',
    'sinkUnlimitedDAO as unlimitedDAO' ],

  exports: [ 'dao' ],

  properties: [
    {
      name: 'of',
      transient: true,
      hidden: true,
      factory: function() { return this.referenceDAO?.of; }
    },
    {
      // The current shown-driven render dynamic; detached and replaced on re-execute
      // so re-executions don't leave stale dynamics rendering into a detached element.
      name: 'shownDynamic_',
      transient: true,
      hidden: true
    }
  ],

  methods: [
    function value(s) { return null; },
    function createSink() { return this.ArraySink.create(); },
    async function execute(e) {
      var sink = this.createSink();
      let self = this;
      return this.dao.select(sink).then(s => {
        if ( this.block.value && this.block.value.VALUE ) {
          this.block.value.value = this.value(s);
        } else {
          this.block.value = this.value(s);
        }

        // This is needed in case the Sink traveled across the network but needs values
        // (like 'block') from the current context.
        s = s.clone(this.__subContext__);

        // On re-execute detach the previous shown-dynamic so we don't accumulate stale
        // ones re-adding the sink into a detached `e`.
        if ( self.shownDynamic_ ) self.shownDynamic_.detach();
        self.shownDynamic_ = self.block.dynamic(function (shown) {
          if ( shown )
            this.startContext({dao: self.dao}).start().call(function() { self.addSinkToE(this, s); }).endContext();
        });
        e.add(self.shownDynamic_);
      }).catch(error => {
        console.error('AbstractDAOAgent execution error:', error);
        e.tag(self.ErrorView, { error: error });
        // Don't re-throw the error to allow other blocks to continue loading
      });
    },
    function addSinkToE(e, s) {
      e.add(s);
    },
    function addToE() {}
  ]
});
