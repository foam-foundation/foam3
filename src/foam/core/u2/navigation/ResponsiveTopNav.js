/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'ResponsiveTopNav',
  extends: 'foam.u2.View',

  documentation: 'FOAM Responsive Top Nav',

  imports: [
    'displayWidth',
    'isMenuOpen',
    'loginSuccess',
    'menuDAO',
    'pushDefaultMenu?',
    'theme',
    'toolbar?'
  ],

  cssTokens: [
    {
      name: 'topNavBackground',
      value: '$foam.core.menu.VerticalMenu.menuBackground'
    },
    {
      name: 'borderSize',
      value: '2px solid'
    },
    {
      name: 'borderColor',
      variantKey: 'color',
      value: function(e) { return e.ADJUST_ALPHA(e.TOKEN('$textDefault'), 0.06) }
    }
  ],

  css: `
    ^ {
      align-items: center;
      background-color: $topNavBackground;
      border-bottom: $borderSize;
      border-color: $borderColor;
      display: flex;
      min-height: 64px;
      justify-content: space-between;
      padding: 8px 16px;
      position: relative;
      width: 100%;
    }
    ^components-container {
      flex: 1;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
    }
    ^components-container^logo-adjust {
      gap: 16px;
    }
    ^menuControl.foam-u2-view-NavigationButton {
      justify-content: flex-start;
    }
    ^logo {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
    }
    ^support {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      margin-right: 8px;
      color: $textDefault;
      text-decoration: none;
      border-radius: 4px;
      transition: background-color 0.2s;
      font-size: 14px;
      font-weight: 500;
    }
    ^support:hover {
      background-color: $grey50;
      text-decoration: none;
    }
    ^support:visited {
      color: $textDefault;
    }

    @media (min-width: /*%DISPLAYWIDTH.MD%*/ 768px) {
      ^components-container {
        display: flex;
        flex: 1;
        gap: 8px;
      }
      ^right {
        justify-content: flex-end;
      }
      ^logo {
        position: static;
        left: auto;
        transform: none;
      }
    }
  `,

  properties: [
    {
      name: 'notifications'
    },
    {
      name: 'nodeName',
      value: 'header'
    }
  ],

  methods: [
    function checkNotificationAccess() {
      this.menuDAO.find('notifications').then(bb=>{
        this.notifications = bb;
      });
    },
    function render() {
      var self = this;
      this.checkNotificationAccess();
      this
        .show(this.loginSuccess$)
        .addClass(this.myClass())
        .start().addClass(this.myClass('components-container'))
          // Menu Open/Close
          .addClass(this.myClass('logo-adjust'))
          .startContext({ data: this })
            .start(this.MENU_CONTROL, { themeIcon: 'hamburger', buttonStyle: 'TERTIARY', size: 'SMALL' })
              .addClass(this.myClass('menuControl'))
            .end()
          .endContext()
          .start({ class: 'foam.core.u2.navigation.ApplicationLogoView' })
            .addClass(this.myClass('logo'))
            .on('click', () => {
              this.pushDefaultMenu();
            })
          .end()
        .tag('span', {}, this.toolbar$) // Is exported by ApplicationController
        .end()
        // .tag({class: 'foam.core.so.SystemNotificationBorder'})
        .add(this.slot(function(displayWidth) {
          if ( displayWidth.ordinal >= foam.u2.layout.DisplayWidth.MD.ordinal ) {
            return this.E().addClass(this.myClass('components-container'), this.myClass('right'))
            .add(self.slot(function(notifications) {
              if ( ! notifications ) return;
              return this.E().start(notifications, {
                label: foam.core.u2.navigation.NotificationMenuItem.create({}, self),
                buttonStyle: 'UNSTYLED'
              }).show(notifications).end();
            }))
            .callIf(self.theme && self.theme.supportConfig && self.theme.supportConfig.supportLink, function() {
              this.tag(self.SUPPORT)
            })
            .tag({ class: 'foam.core.auth.LanguageChoiceView' })
            .tag({ class: 'foam.core.u2.navigation.UserInfoNavigationView' });
          } else {
            return this.E()
              .tag({ class: 'foam.core.auth.LanguageChoiceView' });
          }
        }));
    }
  ],

  actions: [
    {
      name: 'menuControl',
      label: '',
      ariaLabel: 'Open/Close Menu',
      code: function() {
        this.isMenuOpen = ! this.isMenuOpen;
      }
    },
    {
      name: 'support',
      label: 'Support',
      buttonStyle: 'SECONDARY',
      size: 'SMALL',
      icon: 'images/flag.svg',
      code: function(X) {
        var theme = X.theme;
        if ( theme && theme.supportConfig && theme.supportConfig.supportLink ) {
          window.open(theme.supportConfig.supportLink, '_blank', 'noopener,noreferrer');
        }
      }
    }
  ]
});
