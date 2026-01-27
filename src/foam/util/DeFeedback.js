/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.util',
  name: 'DeFeedback',

  description: 'Mixin to add de-feedback functionality to a class',

  properties: [
    {
      class: 'Boolean',
      name: 'feedback_'
    }
  ],

  methods: [
    function deFeedback(fn) {
      /** Call the supplied function with feedback elimination. **/
      if ( this.feedback_ ) return;
      this.feedback_ = true;
      try {
        fn();
      } catch(e) {
        console.error('deFeedback error:', e);
      } finally {
        this.feedback_ = false;
      }
    }
  ]
});
