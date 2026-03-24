/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ReadOnlyEnumView',
  extends: 'foam.u2.View',

  requires: ['foam.u2.tag.CircleIndicator'],

  imports: ['returnExpandedCSS', 'theme'],

  css: `
    ^pill{
      align-items: center;
      border-radius: 11.2px;
      border: 1px solid;
      display: inline-flex;
      justify-content: space-around;
      min-width: 88px;
      padding: 0 12px;
      width: -webkit-max-content;
      width: -moz-max-content;
    }
    ^icon{
      margin-right: 4px;
    }
  `,

  documentation: 'Creates badges with rounded/squared sides based on display context',

  properties: [
    {
      class: 'Boolean',
      name: 'showGlyph'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.dynamic(function(data) {
        this.removeAllChildren();
        var color = this.resolveColor(this.data.color);
        var background = this.resolveColor(this.data.background);
        var borderColor = this.resolveColor(this.data.borderColor);
        var isPill = this.isFancy(this.data.VALUES);
        this
          .enableClass(this.myClass('pill'), isPill)
          .addClass('enum-label', this.myClass())
          .style({ 'width': 'max-content' })
          .style({
            'background-color': background,
            'color': color,
            'border-color': borderColor
          })
          .callIf(this.showGlyph && (data.glyph || data.icon), () => {
            var icon = {
              size: 14,
              backgroundColor: color,
              icon: data.glyph?.clone(this).getDataUrl({
                fill: background || color
              }) ?? data.icon
            };
            this.start(this.CircleIndicator, icon).addClass(this.myClass('icon')).end();
          })
          .callIfElse(isPill,
            () => { this.start().add(data.label).end(); },
            () => { this.start().addClass('p').add(data.label).end(); }
          );
      });
    },
    {
      name: 'isFancy',
      code: foam.Function.memoize1(function(values) {
        for ( value of values ) {
          if ( value.color || value.background ) { return true; }
        }
      })
    },
    function resolveColor(token) {
      if ( token.startsWith('$') )
        return foam.CSS.returnTokenValue(token, this.cls_, this.__context__);
      return this.returnExpandedCSS(token);
    }
  ]
});
