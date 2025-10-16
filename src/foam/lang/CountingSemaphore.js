/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'CountingSemaphore',

  documentation: 'A Counting Semaphore.',

  requires: [ 'foam.lang.Latch' ],

  static: [
    function test__() {
      var lock = foam.lang.CountingSemaphore.create({limit:1});

      /*
      // Wihtout Locking
      for ( let i = 0 ; i < 10 ; i++ ) {
        setTimeout(function() {
          console.log('start task ' + i);
          setTimeout(function() { console.log('end task ' + i); }, Math.random()*1000);
        }, 0);
      }
      */

      // With Locking
      for ( let i = 0 ; i < 10 ; i++ ) {
        lock.then(function() {
          return new Promise(function (resolve) {
            console.log('start locked task ' + i);
            setTimeout(function() { console.log('end locked task ' + i); resolve(); }, Math.random()*1000);
          });
        }).catch(e =>  {console.error(e)});
      }
    }
  ],

  properties: [
    {
      class: 'Int',
      name: 'count_'
    },
    {
      class: 'Int',
      name: 'limit',
      value: 10
    },
    {
      name: 'queue_',
      factory: function() { return []; }
    },
    'drainLatch_'
  ],

  methods: [
    function then(block) {
      if ( this.count_++ < this.limit ) {
        return block().then(this.decr);
      }

      var latch = this.Latch.create();
      this.queue_.push(latch);
      return latch.then(block).then(this.decr);
    },

    function drain() {
      if ( this.count_ == 0 ) return Promise.resolve();
      return this.drainLatch_ = this.Latch.create();
    }
  ],

  listeners: [
    function decr() {
      this.count_--;
      var latch = this.queue_.shift();
      if ( latch ) latch.resolve();
      if ( this.drainLatch_ && this.count_ == 0 ) this.drainLatch_.resolve();
      return Promise.resolve();
    }
  ]
});
