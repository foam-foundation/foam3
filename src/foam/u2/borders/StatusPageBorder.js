/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'StatusPageBorder',
  extends: 'foam.u2.Element',

  documentation: `
   Border with a header with the application logo. Intended for use
   in unauthenticated status pages (Forgot password, Verify Email, URL not found)

   Also wraps content in a scrollBorder
  `,

  requires: [
    'foam.u2.borders.ScrollBorder',
    'foam.u2.tag.Image'
  ],

  imports: [
    'stack?',
    'theme?'
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      bottom: 0;
      height: 100%;
      left: 0;
      position: fixed;
      right: 0;
      top: 0;
      width: 100%;
      z-index: $z-modal;
    }
    ^header {
      background: $backgroundDefault;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid $borderLight;
    }

    ^header-left {
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    ^header-center {
      display: flex;
      text-align: center;
      align-items: center;
      justify-content: center;
    }

    ^body {
      background: $backgroundDefault;
      flex-grow: 1;
      max-height: var(--max-height, 100vh);
      overflow: auto;
      display: flex;
      align-items: center;
      flex-direction: column;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'showBack',
      value: true
    }
  ],

  methods: [
    function init() {
      this
        .addClass()
        .start()
          .addClass(this.myClass('header'))
          .start()
            .addClass(this.myClass('header-left'))
            .startContext({ data: this.stack })
              .start(this.stack?.BACK, {
                buttonStyle: 'LINK',
                icon: 'images/back-icon.svg',
                themeIcon: 'back'
              })
                .show(this.showBack$.and(this.stack$))
              .end()
            .endContext()
          .end()
          .start()
            .addClass(this.myClass('header-center'))
            .tag({ class: 'foam.core.u2.navigation.ApplicationLogoView' })
          .end()
        .end()
        .start(this.ScrollBorder)
          .addClass(this.myClass('body'))
          .tag('div', null, this.content$)
        .end();
    }
  ]
});
