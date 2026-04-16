/**
* @license
* Copyright 2021 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'NavigationController',
  extends: 'foam.u2.Controller',

  documentation: 'Component to combine Macro layouts',

  cssTokens: [
    {
      name: 'sidebarBoxShadow',
      value: 'none',
    },
    {
      name: 'borderColor',
      value: '$borderDefault'
    }
  ],

  css: `
    :root {
      --sidebar-width: 240px;
      --topbar-height: 0px;
      --footer-height: 0px;
    }

    /******************
    Replace sidebar-width when Chrome
    and Safari add animation support
    to grid-template-columns
    ---------
    ^ {
      display: grid;
      grid-template: auto 1fr / minmax(240px, 10%) 1fr;
    }
    ********************/

    ^ {
      display: grid;
      height: 100%;
      grid-template: auto 1fr / auto 1fr;
    }


    ^header {
      grid-column: 1 / 3;
    }

    ^sideNav {
      grid-column: 1 / 2;
      height: calc(100% - var(--topbar-height));
      overflow: auto;
      position: absolute;
      top: var(--topbar-height);
      z-index: 100;
    }

    ^stack-view {
      grid-column: 2 / 3;
      height: 100%;
      overflow: auto;
      transition: 0.2s ease;
    }
    /*  When nav is hidden, make stack view take up all columns */
    :not(^showNav) > ^stack-view {
      grid-column: 1/3;
      grid-row: 1/3;
    }

    ^sidebar^sideNav{
      transition: 0.2s ease;
      width: var(--sidebar-width);
      box-shadow: $sidebarBoxShadow;
    }

    ^sidebarClosed^sideNav{
      transition: 0.2s ease;
      width: 0px;
    }


    @media only screen and (min-width: /*%DISPLAYWIDTH.LG%*/ 960px) {
      ^sideNav{
        height: auto;
        position: relative;
        top: 0;
        z-index: 1;
      }
    }
  `,

  imports: [
    'displayWidth',
    'document',
    'initLayout',
    'isMenuOpen',
    'loginSuccess',
    'prefersMenuOpen',
    'showNav',
    'stack'
  ],

  requires: [
    'foam.u2.stack.DesktopStackView',
    'foam.u2.layout.DisplayWidth'
  ],

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'topNav'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'sideNav'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'footer'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'mainView'
    },
    {
      name: 'headerSlot_'
    },
    {
      name: 'navCtx_'
    },
    ['layoutResolved_', false]
  ],
  methods: [
    function render() {
      var self  = this;
      // TODO: Add responsive View switching
      this.onDetach(this.headerSlot_$.sub(this.adjustTopBarHeight));
      this.onDetach(this.displayWidth$.sub(this.maybeCloseNav));
      this.onDetach(this.isMenuOpen$.sub(this.setUserMenuPreference));


      // on initlayout reset context so that navigation views will be created
      // under the correct context
      this.initLayout.then(() => {
        this.__subSubContext__ = ctrl.__subContext__;
        self.setNavCtx_();
        self.layoutResolved_ = true;
      });
      this.maybeCloseNav();

      this.setNavCtx_();

      this.addClass()
        .enableClass(this.myClass('showNav'), this.showNav$)
        .add(this.slot( async function(layoutResolved_, topNav) {
          let e = self.E().addClass(this.myClass('header'));
          if ( ! layoutResolved_ || ! topNav || foam.flags.topNav == false ) return e;
          var topView = foam.u2.ViewSpec.createView(topNav, {}, self, self.navCtx_);
          this.headerSlot_$.set(topView);
          var resize = new ResizeObserver (this.adjustTopBarHeight);
          this.onDetach(resize.disconnect());
          this.headerSlot_?.el().then(el => {
            resize.observe(el);
          })
          return e
            .addClass(this.myClass('header'))
            // Fix this
            // .tag(topNav, {}, self.headerSlot_$)
            .add(topView)
            .show(this.showNav$);
        }))
        .add(this.slot( async function(layoutResolved_, sideNav) {
          let e = self.E().addClass(this.myClass('sideNav'));
          if ( ! layoutResolved_ || ! sideNav ) return e;
          var sideView = foam.u2.ViewSpec.createView(sideNav, {}, self, self.navCtx_);
          return e
            // .tag(sideNav)
            .add(sideView)
            .show(this.showNav$)
            .enableClass(this.myClass('sidebarClosed'), this.isMenuOpen$, true)
            .enableClass(this.myClass('sidebar'), this.isMenuOpen$)
            .addClass(this.myClass('sideNav'));
        }))
        .add(this.slot(function(mainView) {
          return this.E()
            .add(mainView)
            .addClass(this.myClass('stack-view'));
        }))

      // TODO: Maybe add footer support if needed
    }
  ],

  listeners: [
    function setNavCtx_() {
      // Workaround to register these classes without propogating to the rest of the app
      var a = this.__subSubContext__.createSubContext({});
      a.register(foam.u2.view.NavigationButton, 'foam.u2.ActionView');
      a.register(foam.u2.view.NavigationMenu, 'foam.u2.view.MenuView');
      a.register(foam.u2.view.NavigationOverlayButton, 'foam.u2.view.OverlayActionListView');
      this.navCtx_ = a;
    },
    // required as a seperate function because this listens to isMenuOpen, which can be toggled by user clicking on hamburger menu
    function setUserMenuPreference() {
      if (this.displayWidth.ordinal > this.DisplayWidth.MD.ordinal) {
              this.prefersMenuOpen = this.isMenuOpen;
        }
      },
    function maybeCloseNav() {
      if (this.displayWidth.ordinal <= this.DisplayWidth.MD.ordinal) {
        this.isMenuOpen = false
      } else if ( this.displayWidth.ordinal >= this.DisplayWidth.MD.ordinal && this.prefersMenuOpen === true) {
        this.isMenuOpen = true
      }
    },
    function adjustTopBarHeight() {
      if ( ! this.headerSlot_ ) return;
      let root = this.document.documentElement;
      this.headerSlot_.el().then(el => {
        root?.style.setProperty('--topbar-height', el.offsetHeight + 'px' );
      })
    }
  ]
});
