/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'JSONSink',
  extends: 'foam.dao.ArraySink',

  properties: [
    {
      name: 'json',
      transient: true,
      expression: function(array) {
        return foam.json.Outputter.create({
          pretty: true,
          strict: true,
          propertyPredicate: function(o, p) { return ! p.networkTransient; }
        }).stringify(array);
      }
    }
  ],

  methods: [
    function addToE(e) {
      e.start('pre').add(this.json);
    }
  ]
});
