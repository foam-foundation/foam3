/**
* @license
* Copyright 2023 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.view',
  name: 'RODateTimeView',
  extends: 'foam.u2.View',

  documentation: 'A ReadOnly DateTime View',

  properties: [
    {
      class: 'Map',
      name: 'options',
      factory: function() {
        return {};
      }
    },
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
      var self = this;
      this.start().
        addClass(this.myClass()).
        add(this.data$.map(d => {
          if ( ! d ) return foam.u2.DateTimeView.DATE_FORMAT;
          if ( self.prop && self.prop.formatLocale ) {
            return self.prop.formatLocale(d);
          }
          return new Date(d).toLocaleString(foam.locale, self.options);
        })).
      end();
    }
  ]
});
