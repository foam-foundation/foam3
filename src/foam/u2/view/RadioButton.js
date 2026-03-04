/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'RadioButton',
  extends: 'foam.u2.Element',

  documentation: 'A single radio button. Logic implemented in RadioView.js',

  imports: [ 'theme?' ],

  css: `
  ^innerCircle.selected {
    r: 5px;
  }
  ^innerCircle {
    transition: 0.1s ease;
    transform-origin: center center;
    transform-box: stroke-box;
    r: 0;
  }
  `,

  properties: [
    [ 'nodeName', 'svg' ],
    {
      name: 'selectedColor',
      expression: function(isSelected, isDisabled) {
        if ( isDisabled ) return '$backgroundInverseTertiary';
        if ( isSelected ) return '$backgroundBrand';
        return '$backgroundInverse';
      }
    },
    {
      class: 'Boolean',
      name: 'isDisabled'
    },
    {
      class: 'Boolean',
      name: 'isSelected'
    }
  ],

  methods: [
    function render() {
      const e = foam.css.TokenUtilsBuilder.create({}, this);
      let colorSlot = this.slot(function(selectedColor, theme) { return e.TOKEN(selectedColor).f(this); });

      this
        .addClass('radio')
        .attrs({ width: 20, height: 20 })
        .start('circle')
          .attrs({ cx: 10, cy: 10, r: 8, 'stroke': colorSlot, 'stroke-width': 2, 'transform-origin': '0 0', fill: 'none' })
        .end()
        .start('circle')
          .addClass(this.myClass('innerCircle'))
          .enableClass('selected', this.isSelected$)
          .attrs({ cx: 10, cy: 10, r: 0, fill: colorSlot })
        .end();
    }
  ]
});
