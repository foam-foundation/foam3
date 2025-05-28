/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.tag',
  name: 'CircleIndicator',
  extends: 'foam.u2.Element',

  documentation: `
    Displays a coloured circle containing a number or icon.
  `,

  flags: ['web'],

  requires: [
    'foam.lang.ExpressionSlot',
    'foam.u2.LoadingSpinner',
    'foam.u2.tag.Image'
  ],

  css: `
    ^ {
      position: relative;
      border-radius: 50%;
      text-align: center;
      display: inline-flex;
      overflow: hidden;
      align-items: center;
      justify-content: center;
    }
    ^ > img {
      pointer-events: none;
    }
    ^ svg {
      height: 100%;
      width: 100%;
    }
  `,

  properties: [
    // Configuration
    {
      name: 'label',
      class: 'String'
    },
    {
      name: 'borderColor',
      class: 'String'
    },
    {
      name: 'borderColorHover',
      class: 'String'
    },
    {
      name: 'textColor',
      class: 'String',
      expression: function (stateBorderColor_) { return stateBorderColor_; }
    },
    {
      name: 'backgroundColor',
      class: 'String'
    },
    {
      name: 'borderThickness',
      class: 'Int'
    },
    {
      name: 'icon',
      class: 'Image'
    },
    {
      name: 'glyph'
    },
    {
      name: 'size',
      value: 30
    },
    {
      name: 'padding',
      class: 'String'
    },

    // State
    {
      name: 'hasMouseOver',
      class: 'Boolean',
      value: false
    },
    {
      name: 'stateBorderColor_',
      expression: function ( borderColor, borderColorHover, hasMouseOver ) {
        return hasMouseOver ? borderColorHover : borderColor;
      }
    },
    {
      name: 'clickable',
      class: 'Boolean'
    },
    {
      name: 'indicateProcessing',
      class: 'Boolean'
    }
  ],

  methods: [
    function render() {
      let size = foam.lang.Int.isInstance(this.size) ? this.size+'px' : this.size;
      this
        .addClass(this.myClass())
        .style({
          'background-color': this.backgroundColor,
          'border-color': this.stateBorderColor_$,
          'width': size,
          'height': size,
          'color': this.textColor$,
          'border': this.borderThickness + 'px solid',
          'padding': this.padding,
          'cursor': this.ExpressionSlot.create({
            obj: this,
            code: function (clickable) {
              return clickable ? 'pointer' : 'default';
            }
          })
        })
        .on('mouseover', () => {
          this.hasMouseOver = true;
        })
        .on('mouseout', () => {
          this.hasMouseOver = false;
        })
        .attr('border');

      if ( this.glyph || this.icon ) {
        this.tag(this.Image, { data: this.icon, glyph: this.glyph, displayWidth: size, displayHeight: size});
      }

      if ( this.indicateProcessing ) {
        this.tag(this.LoadingSpinner);
      }

      if ( this.label ) {
        this.add(this.label);
      }
    }
  ]
});
