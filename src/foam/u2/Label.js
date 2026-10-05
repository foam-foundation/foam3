/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'Label',
  extends: 'foam.u2.View',

  imports: [ 'theme?' ],

  documentation: `
    Generic implementation for a view that renders a label and icon
    TODO: Use for labels in controls (Actions, Menus, Tabs etc...)
  `,

  css: `
    <<{
      display: flex;
      align-items: center;
      gap: 0.8rem;
      justify-content: flex-start;
    }
    <<vertical {
      flex-direction: column;
    }
    <<svgIcon {
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
    }
    <<svgIcon svg {
      height: 1.15em;
      width: 1.15em;
      fill: currentColor;
    }
    <<svgIcon svg {
      font-size: initial;
    }

    /* SVGs outside themeGlyphs may have their own heights and widths,
    these ensure those are respected rather than imposing new dimensions */
    <<imgSVGIcon {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    <<imgSVGIcon svg {
      height: initial;
    }
  `,

  properties: [
    {
      name: 'label'
    },
    {
      name: 'themeIcon'
    },
    {
      name: 'icon'
    },
    {
      class: 'Boolean',
      name: 'vertical'
    },
    {
      class: 'String',
      name: 'labelClass'
    }
  ],

  methods: [
    function render() {
      this.addClass().enableClass(this.myClass('vertical'), this.vertical$);
      if ( this.themeIcon && this.theme ) {
        this
          .start({ class: 'foam.u2.tag.Image', glyph$: this.themeIcon$, role: 'presentation' })
            .addClass(this.myClass('SVGIcon'))
          .end();
      } else if ( this.icon ) {
        this
          .start({ class: 'foam.u2.tag.Image', data$: this.icon$, role: 'presentation', embedSVG: true })
            .addClass(this.myClass('SVGIcon'), this.myClass('imgSVGIcon'))
          .end();
      }
      this.start().addClass(this.labelClass$).add(this.label$).end();
    }
  ]
});
