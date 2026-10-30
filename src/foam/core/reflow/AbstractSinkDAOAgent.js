/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AbstractSinkDAOAgent',
  extends: 'foam.core.reflow.AbstractDAOAgent',

  properties: [
    {
      class: 'FObjectProperty',
      name: 'sink',
      autoValidate: true,
      preSet: function(o, n) {
        // Temporary fix to recontextualize the object after load.
        // TODO: remove once JSON parsing/loading is fixed
        if ( n && n.__context__ != this.__subContext__ ) {
          return n.clone(this.__subContext__);
        }
        return n;
      }
    }
  ]
});
