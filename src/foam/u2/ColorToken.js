/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'ColorToken',
  extends: 'foam.u2.CSSToken',
  requires: ['foam.u2.CSSToken'],
  documentation: 'SubClass of CSS tokens that installs convenience tokens for different states',

  properties: [
    {
      class: 'String',
      name: 'variantKey',
      value: 'color'
    },
    {
      class: 'Int',
      name: 'hoverModifier',
      value: -20
    },
    {
      class: 'Int',
      name: 'activeModifier',
      value: -40
    },
    {
      class: 'Int',
      name: 'disabledModifier',
      value: 60
    },
    {
      class: 'String',
      name: 'onLight',
      value: '$black'
    },
    {
      class: 'String',
      name: 'onDark',
      value: '$white'
    }
  ],

  methods: [
    function installInClass(cls) {
      this.SUPER(cls);
      let ax = this;
      ['hover', 'active', 'disabled'].forEach(a => {
        let n = `${ax.name}$${a}`;
        Object.defineProperty(
          cls,
          foam.String.constantize(n),
          {
            get: function() {
              return foam.u2.CSSToken.create({
                name: n,
                value: function(e) { return e.LIGHTEN(e.TOKEN('$' + ax.name), ax[`${a}Modifier`]); },
                fallback: ax.fallback
              });
            }
          }
        );
      });
      ['', 'hover', 'active', 'disabled'].forEach(a => {
        let n = a ? `${ax.name}$${a}$foreground` : ax.name + '$foreground';
        Object.defineProperty(
          cls,
          foam.String.constantize(n),
          {
            get: function() {
              return foam.u2.CSSToken.create({
                name: n,
                value: function(e) { return e.FOREGROUND(e.TOKEN(a ? `$${ax.name}$${a}` : '$' + ax.name), e.TOKEN(ax.onLight), e.TOKEN(ax.onDark)); }
              });
            }
          }
        );
      });
    }
  ]
});
