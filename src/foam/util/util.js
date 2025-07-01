/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.util',
  methods: [
    function backoff(fn, maxDelay = 30000, maxAttempts = 3) {
      return function() {
        var delay = 100;
        var attempt = 0;
        var fail = function() {
          if ( maxAttempts == -1 || ++attempt < maxAttempts ) {
            setTimeout(function () {
              fn(fail);
            }, delay);
            delay = Math.min(delay * 2, maxDelay);
            return;
          }
          abort();
        }

        fn(fail);
      };
    }
  ]
});
