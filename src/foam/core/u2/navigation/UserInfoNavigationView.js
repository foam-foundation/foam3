/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
*/
foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'UserInfoNavigationView',
  extends: 'foam.u2.View',

  documentation: 'Displays user and agent label if present. Clicking view opens settings submenu.',

  requires: [
    'foam.core.menu.Menu',
    'foam.lang.Action',
    'foam.u2.view.OverlayActionListView',
    'foam.core.u2.navigation.UserInfoView',
    'foam.dao.FnSink'
  ],

  imports: [
    'theme',
    'subject',
    'translationService',
    'menuDAO'
  ],

  css: `
    ^ {
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    ^horizontal {
      flex-direction: row;
    }
    ^horizontal > * + * {
      margin-left: 8px;
    }
    ^dropdown svg {
      fill:  $textTertiary;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'horizontal'
    },
    {
      name: 'menuItems',
      class: 'Array'
    }
  ],

  methods: [
    function init() {
      this.onDetach(this.menuDAO.listen(this.FnSink.create({ fn: this.onMenuDAOUpdated })));
    },
    async function render() {
      var self = this;
      var X    = this.__subContext__;
      this.__subContext__.register(foam.u2.view.MenuView, 'foam.u2.view.MenuView');

      this
      .addClass(this.myClass())
      // OverlayActionListView does not support slots;
      // this will rerender it when the menuItems slot updates.
      .add(this.menuItems$.map(finalArray => {
          return this.E()
            .start(this.OverlayActionListView, {
              label: this.UserInfoView.create().enableClass(this.myClass('horizontal'), this.horizontal$),
              data: finalArray,
              obj: self,
              buttonStyle: 'UNSTYLED'
            }).addClass(this.myClass('dropdown')).end();
          }))
      .end();
    },
    function refreshEntries() {
      // We need to add menus from settings (and then add menus from theme.settingsRootMenu)
      // because some menus are used in both settings and theme.settingsRootMenu (e.g., sign-out).
      // Doing this prevents us from creating the same menu for each setting.
      let menu = this.Menu.create({ id: 'settings' });
      var self = this;
      menu.children.select().then(settingsMenuResult => {
        var settingsMenuResultArray = settingsMenuResult.array;
        let settingsMenuName = self.theme.settingsRootMenu;
        if ( settingsMenuName !== 'settings' ) {
          let customMenu = self.Menu.create({ id: settingsMenuName });
          customMenu.children.select().then( customSettingsMenuResult => {
            let customSettingsMenuResultArray = customSettingsMenuResult.array;
            settingsMenuResultArray.concat(customSettingsMenuResultArray);
            settingsMenuResultArray.sort((a, b) => a.order - b.order);
            self.menuItems = settingsMenuResultArray;
          });
        } else {
          settingsMenuResultArray.sort((a, b) => a.order - b.order);
          self.menuItems = settingsMenuResultArray;
        }
      });
    }
  ],
  listeners: [
    {
      name: 'onMenuDAOUpdated',
      code: function() {
        this.refreshEntries();
      }
    },

  ]
});


foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'UserInfoView',
  extends: 'foam.u2.View',

  documentation: '',

  imports: [
    'ctrl',
    'subject'
  ],

  css: `
    ^name-container {
      max-width: 90px;
      line-height: normal;
      display: flex;
    }
    ^name-container > *{
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    ^label-container {
      display: flex;
      flex-direction: column;
    }
  `,

  methods: [
    async function render() {
      var self = this;
      this.subject = await ctrl.__subContext__.auth.getCurrentSubject(null);
      this
        .addClass(this.myClass('label-container'))
        .add(this.slot(function(subject$user) {
          if ( ! subject$user ) return;
          return this.E().addClass(self.myClass('name-container'))
              .start('span')
                .addClass('p-label')
                .add(subject$user.toSummary())
              .end();
        }))
        .add(this.slot(function(subject$realUser, subject$user) {
          if ( ! subject$user || ! subject$realUser || subject$user.id == subject$realUser.id ) return;
          return this.E().addClass(self.myClass('name-container'))
              .start('span')
                .addClass('p-legal-light', this.myClass('agentName'))
                .add( subject$realUser.toSummary() )
              .end();
        }));
    }
  ]
});
