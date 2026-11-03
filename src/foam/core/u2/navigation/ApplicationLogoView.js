/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
*/
foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'ApplicationLogoView',
  extends: 'foam.u2.View',

  documentation: 'View displaying Application logo and name.',

  imports: [
    'group',
    'pushMenu',
    'theme',
    'displayWidth'
  ],

  requires: [
    'foam.u2.layout.DisplayWidth',
    'foam.u2.tag.Image'
  ],

  css: `
    << {
      display: flex;
      align-items: center;
      cursor: pointer;
    }
    << img, << svg {
      height: 25px;
      max-height: 40px;
      /* remove and override any image styling to preserve aspect ratio */
      width: unset;
    }
  `,

  properties: [
    {
      name: 'isDesktop'
    }
  ],

  methods: [
    function render() {
      this.handleDisplayWidth();
      this.displayWidth$.sub(this.handleDisplayWidth);
      this
        .addClass(this.myClass())
        .start(this.Image, {
          data$: this.slot(function(theme$shouldResizeLogo, theme$topNavLogo, theme$largeLogoEnabled, isDesktop) {
            if ( theme$shouldResizeLogo && theme$largeLogoEnabled && ! isDesktop ) {
              return this.theme.logo;
            }
            return theme$topNavLogo;
          }),
          embedSVG: true
        })
        .end();
    }
  ],

  listeners: [
    {
      name: 'handleDisplayWidth',
      code: function() {
        this.isDesktop = this.displayWidth.ordinal > this.DisplayWidth.SM.ordinal;
      }
    }
  ]
});
