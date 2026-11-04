/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'AvgDAOAgent',
  extends: 'foam.core.reflow.MinDAOAgent',

  properties: [
    {
      name: 'prop',
      label: 'Property',
      validateObj: function(prop) { if ( ! prop ) return 'Required'; },
      view: function(_, X) {
        return {
          class: 'foam.core.reflow.PropertyChoiceView',
          forCls: X.data.of,
          predicate: function(p) {
            // Other number types are all descendents of Int
            return foam.lang.Int.isInstance(p);
          }
        };
      }
    }
  ],

  methods: [
    function createSink() {
      var sink = this.AVG(this.prop);
      sink.precision = this.precision;
      return sink;
    }
  ]
});
