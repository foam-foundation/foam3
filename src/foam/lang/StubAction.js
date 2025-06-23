/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'StubAction',
  extends: 'Action',

  requires: [
    'foam.lang.StubMethod'
  ],

  properties: [
    'boxPropName',
    {
      name: 'stubMethod',
      factory: function() {
        return this.StubMethod.create({
          name: this.name,
          boxPropName: this.boxPropName
        });
      }
    },
    {
      name: 'code',
      factory: function() {
        return function(ctx, action) {
          action.stubMethod.code.call(this);
        };
      }
    }
  ],

  methods: [
    function installInProto(proto) {
      proto[this.name] = this.stubMethod.code;
    }
  ]
});
