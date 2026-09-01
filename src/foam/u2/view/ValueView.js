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

  imports: [ 'translationService?' ],

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
            return prop.unitPropValueToString.call(self.__subContext__.objData, self.__subContext__, data, unitProp, prop.hideId);
          }, this.data$, unitPropSlot) :
          this.slot(function(data) {
            return prop.unitPropValueToString.call(self.__subContext__.objData, self.__subContext__, data, self.__subContext__.objData[prop.unitPropName], prop.hideId);
          })
        );
      } else {
        // 'units' is a plain string on the property axiom, so translate at
        // display time; flat key shared by all property types.
        var units = prop?.units;
        if ( units && this.translationService ) {
          units = this.translationService.getTranslation(foam.locale, 'foam.units.' + units, units);
        }
        this.add(this.data$.map(v => {
          let ret = v;
          if ( prop?.name !== 'id' && foam.Number.isInstance(v) && foam.lang.Int.isSubClass(prop) && prop.formatValue ) {
            ret = Number(v).toLocaleString(foam.util.getClientLocale());
          }
          return ret + (units ? ` ${units}` : '');
        }));
      }
    }
  ]
});
