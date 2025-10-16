/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ValueView',
  extends: 'foam.u2.View',

  documentation: 'Just shows the value of data as a string.',

  css: `
    ^ {
      display: block;
    }
  `,

  properties: [
    [ 'nodeName', 'SPAN' ],
    {
      name: 'prop'
    }
  ],

  methods: [
    function fromProperty(prop) {
      this.SUPER(prop);
      this.prop = prop;
    },

    function render() {
      this.SUPER();
      this.addClass();

      var self = this;
      var prop = this.prop;

      if ( prop && prop.unitPropValueToString ) {
        var unitPropSlot = self.__subContext__.objData?.slot(prop.unitPropName);
        this.add(
          unitPropSlot ?
          this.slot(function(data, unitProp) {
            return prop.unitPropValueToString.call(self.__subContext__.objData, self.__subContext__, data, unitProp);
          }, this.data$, unitPropSlot) :
          this.slot(function(data) {
            return prop.unitPropValueToString.call(self.__subContext__.objData, self.__subContext__, data, self.__subContext__.objData[prop.unitPropName]);
          })
        );
      } else {
        this.add(this.data$);
      }
    }
  ]
});
