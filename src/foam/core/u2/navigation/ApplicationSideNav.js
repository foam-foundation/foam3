/**
* @license
* Copyright 2021 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.u2.navigation',
  // Find a better name
  name: 'ApplicationSideNav',
  extends: 'foam.u2.View',
  documentation: `
    Combined AppLogo, VerticalMenu and account Navigation Components
    Can be used as the only navigation component or in conjuction with a topbar
  `,

  imports: [
    'currentMenu',
    'menuDAO',
    'pushDefaultMenu',
    'isMenuOpen?',
    'displayWidth?'
  ],

  requires: [
    'foam.core.menu.Menu',
    'foam.core.menu.VerticalMenu',
    'foam.core.u2.navigation.NotificationMenuItem',
    'foam.core.auth.LanguageChoiceView',
    'foam.core.u2.navigation.UserInfoNavigationView'
  ],

  cssTokens: [
    {
      name: 'bottomContainerColor',
      value: '$foam.core.menu.VerticalMenu.menuBackground',
      fallback: '#FFFFFF'
    }
  ],

  css: `
    ^ {
      align-items: flex-start;
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%
    }
    ^sticky-container {
      align-content: flex-start;
      background: $bottomContainerColor;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding: 16px 0;
      position: sticky;
      width: 100%;
      z-index: 10;
    }
    ^bottom-container {
      bottom: 0;
      transition: all 0.2s ease;
    }
    ^top-container {
      top: 0;
    }
    ^bottom-container > * + * {
      margin-top: 4px;
    }
    ^menu-container {
      flex: 1;
      transition: all 0.2s ease;
    }
    ^logo {
      flex: 1;
      padding: 0 16px;
    }
    ^menu-container.foam-core-menu-VerticalMenu {
      padding: 0px;
      border-right: none;
    }
    ^padding.foam-core-menu-VerticalMenu:not(^collapse) {
      padding-top: 16px;
    }
    ^collapse {
      flex: 0;
      padding: 0px;
    }
    ^expand {
      flex: 1;
    }
    @media print {
      ^ { display: none !important; }
    }
  `,
  properties: [
    {
      class: 'Boolean',
      name: 'hasNotifictionMenuPermission'
    },
    {
      name: 'showLogo',
      class: 'Boolean'
    },
    {
      name: 'bottomRoot_'
    }
  ],
  methods: [
    function render() {
      var self = this;
      this.checkNotificationAccess();
      this.addClass()
        .add(this.slot(function(showLogo) {
          return showLogo ? self.E().addClass(this.myClass('sticky-container'), this.myClass('top-container'))
          .start({ class: 'foam.core.u2.navigation.ApplicationLogoView' })
            .addClass(self.myClass('logo'))
            .on('click', () => {
              self.pushDefaultMenu();
            })
          .end() : null;
        }))
        .start(this.VerticalMenu)
          .addClass(this.myClass('menu-container'))
          .enableClass(this.myClass('collapse'), this.bottomRoot_$.map(v => !! v))
          .enableClass(this.myClass('padding'), this.showLogo$.not())
        .end()
        .start()
          .addClass(this.myClass('sticky-container'), this.myClass('bottom-container'))
          // TODO: make this enableClass based on scroll pos
          .addClass(this.myClass('divider'))
          .enableClass(this.myClass('expand'), this.bottomRoot_$.map(v => !! v))
          .start({
            class: 'foam.u2.view.NestedTreeView',
            data: self.menuDAO.where(self.EQ(self.Menu.ENABLED, true)),
            relationship: foam.core.menu.MenuMenuChildrenRelationship,
            startExpanded: false,
            onClickAddOn: function(data, hasChildren) { self.openMenu(data, hasChildren); },
            selection$: self.currentMenu$.map(m => m),
            formatter: function(data) {
              this.translate(data.id + '.label', data.label);
            },
            defaultRoot: 'user-config',
            currentRoot$: this.bottomRoot_$,
            rowConfig: {
              'notifications': { class: 'foam.core.u2.navigation.NotificationMenuItem', showText: true },
              'settings': { class: 'foam.core.u2.navigation.UserInfoView', horizontal: true }
            }
          })
            .addClass(this.myClass('menuList'))

          .end()
        .end();
    },
    function checkNotificationAccess() {
      this.menuDAO.find('notifications').then(bb=>{
        this.hasNotifictionMenuPermission = bb;
      });
    },
    function openMenu(menu, hasChildren) {
      if ( menu.handler ) {
      // When menu is opened close it if window size is small(e.g. phone or tablet) and there are no sub menus
        if ( ! hasChildren && this.displayWidth?.ordinal <= foam.u2.layout.DisplayWidth.MD.ordinal )
          this.isMenuOpen = false;
        menu.handler.select(this.__context__, menu);
      }
    }
  ]
});
