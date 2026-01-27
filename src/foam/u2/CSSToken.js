/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'CSSToken',

  ids:['name'],

  properties: [
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'String',
      name: 'description'
    },
    {
      class: 'String',
      name: 'type',
      value: 'foam.u2.CSSToken'
    },
    {
      class: 'Object',
      name: 'value',
      preSet: function(o, d) {
        var f = ! d || foam.util.isPrimitive(d) || foam.Function.isInstance(d);
        if ( ! f ) {
          this.__context__.warn('Trying to set invalid token value:' + d);
          return o;
        }
        return d;
      }
    },
    {
      class: 'String',
      name: 'fallback',
      preSet: function(o, d) {
        var f = ! d || foam.util.isPrimitive(d);
        if ( ! f ) {
          this.__context__.warn('Set Token fallback to non-primitive:' + d);
          return o;
        }
        return d;
      }
    },
    {
      class: 'String',
      name: 'variantKey',
      documentation: `When providing variants for a token, the variant key decides what variant type the token should change with. For eg.
        A token indicating color might want to update based on the color-mode specified in the theme's active variants such as dark/high contrast.
        While a token being used for spacing might want to update it's values based on the current device type such as phone/desktop.

        A token can only respond to one of the keys in activeVariants and this is denoted by the token's variantKey property.
        FOAM already provides a 'color' and a 'size' key but more can be added or the existing ones can be modified.

        The limitation for one variantKey exists to make it easy to configure CSSTokens. If more complex responsive behaviour is required using
        multiple activeVariants, it's always possible to slot on the property in U2 and write custom logic to handle that case.
      `
    },
    {
      class: 'Map',
      name: 'variants',
      documentation: 'Allows for variant based overrides - dark mode, Accessible themes, responsive design etc',
      adapt: function(_, a, prop) {
        if ( ! a ) return {};
        let newObj = {};
        Object.entries(a).forEach(args => {
          let [k, v] = args;
          newObj[k] = foam.lang.FObject.isInstance(v) ? v : this.clone().copyFrom(v);
        });
        return newObj;
      }
    },
    'sourceCls_'
  ],

  methods: [
    function toSummary() {
      return `name: ${this.name}, value: ${this.value}, fallback: ${this.fallback}`;
    },
    function installInClass(cls) {
      var axiom = this;
      axiom.sourceCls_ = cls;
      Object.defineProperty(
        cls,
        foam.String.constantize(this.name),
        {
          get: function() { return axiom; },
          configurable: true
        }
      );
    },

    function installInProto(proto) {
      this.installInClass(proto);
    }
  ]
});



