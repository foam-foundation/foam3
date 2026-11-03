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

        Required whenever variants is set: a variants map with no variantKey is never read, so installInClass warns. ColorToken sets 'color';
        any other CSSToken that should follow a mode names its key explicitly.
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
      // A variants map is only read when the token names its axis. Without a
      // variantKey the map is dead: the token looks themed in the source and
      // renders its base value in every mode. Warn at class load so the author
      // sees it. A warning, not a throw, keeps an upgrading app loading the
      // class and rendering the base value, like the value and fallback checks.
      // installInProto calls this method with the prototype; cls.prototype is
      // set on the class only, so the token warns once.
      if ( cls.prototype && ! this.variantKey && Object.keys(this.variants).length ) {
        this.__context__.warn(`CSSToken ${cls.id}.${this.name} declares variants (${Object.keys(this.variants).join(', ')}) but no variantKey; set variantKey (for example 'color') or use foam.u2.ColorToken.`);
      }
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



