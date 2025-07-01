/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'XMLSink',
  extends: 'foam.dao.ArraySink',

  properties: [
    {
      name: 'xml',
      transient: true,
      expression: function(array) {
        return foam.xml.Pretty.stringify(array);
      }
    }
  ],

  methods: [
    function addToE(e) { e.start('pre').add(this.xml); }
  ]
});
