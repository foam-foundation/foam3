/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
  Accessible through browser at location path static/foam3/src/foam/core/controller/index.html
  Available on browser console as ctrl. (exports axiom)
*/
foam.CLASS({
  package: 'foam.core.controller',
  name: 'ApplicationController',
  extends: 'foam.u2.Element',
  mixins: [ 'foam.u2.memento.Memorable' ],

  documentation: 'FOAM Application Controller.',

  implements: [
    'foam.box.Context',
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.log.LogLevel',
    'foam.core.client.ClientBuilder',
    'foam.core.controller.AppStyles',
    'foam.core.controller.Fonts',
    'foam.core.analytics.AnalyticEvent',
    'foam.core.auth.Group',
    'foam.core.auth.User',
    'foam.core.auth.Subject',
    'foam.core.crunch.CapabilityIntercept',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.menu.AuthorizationStatus',
    'foam.core.menu.VerticalMenu',
    'foam.core.notification.Notification',
    'foam.core.notification.ToastState',
    'foam.core.theme.Theme',
    'foam.core.theme.Themes',
    'foam.core.theme.ThemeDomain',
    'foam.core.u2.navigation.NavigationController',
    'foam.core.u2.navigation.TopNavigation',
    'foam.core.u2.navigation.FooterView',
    'foam.core.u2.navigation.Stack',
    'foam.core.u2.navigation.PopupManager',
    'foam.u2.LoadingSpinner',
    'foam.u2.crunch.CapabilityInterceptView',
    'foam.u2.crunch.CrunchController',
    'foam.u2.crunch.WizardRunner',
    'foam.u2.wizard.WizardType',
    'foam.u2.stack.BreadcrumbManager',
    'foam.u2.stack.StackBlock',
    'foam.u2.stack.DesktopStackView',
    'foam.u2.dialog.NotificationMessage',
    'foam.core.session.SessionTimer',
    'foam.u2.dialog.Popup',
    'foam.lang.Latch'
  ],

  imports: [
    'installCSS',
    'window'
  ],

  exports: [
    'agent',
    'appConfig',
    'as ctrl',
    'checkGeneralCapability',
    'crunchController',
    'currentMenu',
    'defaultUserLanguage',
    'displayWidth',
    'group',
    'initLayout',
    'initSubject',
    'isMenuOpen',
    'lastMenuLaunched',
    'lastMenuLaunchedListener',
    'layoutInitialized',
    'logAnalyticEvent',
    'login',
    'loginSuccess',
    'loginVariables',
    'loginView',
    'memento_ as topMemento_',
    'menuListener',
    'notify',
    'onUserAgentAndGroupLoaded',
    'popupManager',
    'prefersMenuOpen',
    'pushDefaultMenu',
    'pushMenu',
    'requestLogin',
    'returnExpandedCSS',
    'routeTo',
    'routeToDAO',
    'sessionTimer',
    'showFooter',
    'showNav',
    'signUpEnabled',
    'stack',
    'subject',
    'theme',
    'user',
    'wrapCSS as installCSS',
    'breadcrumbs'
  ],

  topics: [
    'themeChange',
    // Published by reloadClient(), can be subbed to by client side services
    // that need to refresh or cleanup on client reload
    'clientReloading'
  ],

  constants: [
    {
      name: 'MACROS',
      value: [
        'customCSS',
        'logoBackgroundColour',
        'font1',
        'DisplayWidth.XS',
        'DisplayWidth.SM',
        'DisplayWidth.MD',
        'DisplayWidth.LG',
        'DisplayWidth.XL',
        'primary1',
        'primary2',
        'primary3',
        'primary4',
        'primary5',
        'approval1',
        'approval2',
        'approval3',
        'approval4',
        'approval5',
        'secondary1',
        'secondary2',
        'secondary3',
        'secondary4',
        'secondary5',
        'warning1',
        'warning2',
        'warning3',
        'warning4',
        'warning5',
        'destructive1',
        'destructive2',
        'destructive3',
        'destructive4',
        'destructive5',
        'grey1',
        'grey2',
        'grey3',
        'grey4',
        'grey5',
        'black',
        'white',
        'inputHeight',
        'inputVerticalPadding',
        'inputHorizontalPadding'
      ]
    },
    {
      name: 'THEME_OVERRIDE_REGEXP',
      factory: function() { return new RegExp(/\/\*\$(.*)\*\/[^;!]*/, 'g'); }
    }
  ],

  messages: [
    { name: 'GROUP_FETCH_ERR',         message: 'Error fetching group' },
    { name: 'GROUP_NULL_ERR',          message: 'Group was null' },
    { name: 'LOOK_AND_FEEL_NOT_FOUND', message: 'Could not fetch look and feel object' },
    { name: 'LANGUAGE_FETCH_ERR',      message: 'Error fetching language' },
    { name: 'GC_ERROR',                message: 'Please complete general requirements to login' },
    { name: 'GC_ERROR_TITLE',          message: 'Missing Login Requirement'}
  ],

  css: `
    .truncate-ellipsis {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,

  properties: [
    {
      name: 'loginVariables',
      expression: function( client$userRegistrationDAO, group$emailRequired ) {
        return {
          dao_: client$userRegistrationDAO || null,
          emailRequired_: group$emailRequired,
          disableEmail_: ! group$emailRequired,
          imgPath: ''
        };
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'loginView'
    },
    {
      class: 'Enum',
      of: 'foam.u2.layout.DisplayWidth',
      name: 'displayWidth',
      value: foam.u2.layout.DisplayWidth.XL
    },
    {
      name: 'clientPromise',
      factory: function() {
        /* ignoreWarning */
        var self = this;
        return self.ClientBuilder.create({}, this).promise.then(function(client) {
          self.client = client;
          return self.client;
        });
      }
    },
    {
      name: 'client',
    },
    {
      name: 'appConfig',
      expression: function(client$appConfig) {
        return client$appConfig || null;
      }
    },
    {
      name: 'stack',
      factory: function() { return this.Stack.create(); }
    },
    {
      name: 'breadcrumbs',
      factory: function() { return this.BreadcrumbManager.create(); }
    },
    {
      name: 'popupManager',
      factory: function() { return this.PopupManager.create(); }
    },
    {
      class: 'foam.lang.FObjectProperty',
      of: 'foam.core.auth.User',
      name: 'user',
      factory: function() { return this.User.create(); }
    },
    {
      class: 'foam.lang.FObjectProperty',
      of: 'foam.core.auth.User',
      name: 'agent',
      factory: function() { return this.User.create(); }
    },
    {
      class: 'foam.lang.FObjectProperty',
      of: 'foam.core.auth.Subject',
      name: 'subject'
    },
    {
      class: 'foam.lang.FObjectProperty',
      of: 'foam.core.auth.Group',
      name: 'group',
      menuKeys: ['admin.groups']
    },
    {
      class: 'Boolean',
      name: 'signUpEnabled',
      adapt: function(_, v) {
        return foam.String.isInstance(v) ? v !== 'false' : v;
      }
    },
    {
      class: 'Boolean',
      name: 'loginSuccess'
    },
    {
      class: 'Boolean',
      name: 'showFooter',
      value: true
    },
    {
      class: 'Boolean',
      name: 'showNav',
      value: true
    },
    {
      class: 'Boolean',
      name: 'isMenuOpen',
    },
    {
      class: 'Boolean',
      name: 'prefersMenuOpen',
      documentation: 'Stores the menu preference of the user',
      factory: function() {
        return localStorage['prefersMenuOpen'] ? localStorage['prefersMenuOpen'] == 'true' : ( localStorage['prefersMenuOpen'] = true);
      },
      postSet: function(_, n) {
        localStorage['prefersMenuOpen'] = n;
      }
    },
    {
      class: 'Boolean',
      name: 'capabilityAcquired',
      documentation: `
        The purpose of this is to handle the intercept flow for a capability that was granted,
        via the InterceptView from this.requestCapability(exceptionCapabilityType).
      `
    },
    {
      class: 'Boolean',
      name: 'capabilityCancelled'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.session.SessionTimer',
      name: 'sessionTimer',
      factory: function() {
        return this.SessionTimer.create();
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.u2.crunch.CrunchController',
      name: 'crunchController',
      factory: function() {
        return this.CrunchController.create();
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.theme.Theme',
      name: 'theme',
      postSet: function(o, n) {
        if ( o && n && o.equals(n)) return;
        this.__subContext__.cssTokenOverrideService.maybeReload();
        this.pub('themeChange');
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'topNavigation_',
      factory: function() {
        return this.TopNavigation;
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'footerView_',
      factory: function() {
        return this.FooterView;
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'sideNav_'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.auth.Language',
      name: 'defaultLanguage',
      factory: function() {
        return foam.core.auth.Language.create({code: 'en'});
      }
    },
    {
      name: 'route',
      memorable: true
    },
    'currentMenu',
    'lastMenuLaunched',
    {
      name: 'languageDefaults_',
      factory: function() { return []; }
    },
    {
      name: 'styles',
      factory: function() { return {}; }
    },
    {
      class: 'foam.lang.FObjectProperty',
      of: 'foam.lang.Latch',
      name: 'initLayout',
      documentation: 'A latch used to wait on layout initialization.',
      factory: function() {
        return this.Latch.create();
      }
    },
    {
      class: 'Boolean',
      name: 'layoutInitialized',
      documentation: 'True if layout has been initialized.',
    },
    {
      class: 'Boolean',
      name: 'initSubject'
    },
    {
      name: 'defaultUserLanguage',
      factory: function() {
        let l = foam.locale.split('-');
        let code = l[0];
        let variant = l[1];
        let language = foam.core.auth.Language.create({ code: code });
        if ( variant ) language.variant = variant;
        return language;
      }
    },
    //TODO: temporary fix, remove when client signin service is fixed/added
    {
      name: 'groupLoadingHandled',
      class: 'Boolean'
    },
    {
      name: 'notificationSub'
    }
  ],

  methods: [
    function init() {
      this.SUPER();

      // done to start using SectionedDetailViews instead of DetailViews
      this.__subContext__.register(foam.u2.detail.SectionedDetailView, 'foam.u2.DetailView');

      // Reload styling on theme change
      this.onDetach(this.sub('themeChange', this.reloadStyles));
    },

    async function initMenu() {
      if ( this.route ) {
        this.pushMenu(this.route);
      } else  {
        this.pushDefaultMenu();
      }
    },

    function onClientLoad() {
      let self = this;
      this.clientPromise.then(async function(client) {
        if ( self.client != client ) {
          console.log('Stale Client in ApplicationController, waiting for update.');
          await self.client.promise;
          client = self.client;
          // Rebuild stack with correct context
          self.stack = self.Stack.create({}, self.__subContext__);
          self.routeTo(self.window.location.hash.substring(1));
        }

        self.originalSubContext = self.__subContext__;
        self.setPrivate_('__subContext__', { name: 'ApplicationControllerProxy', __proto__: client.__subContext__});
        self.subject = self.client.initSubject;
        self.initSubject = true;
        // For testing purposes only. Do not use in code.
        globalThis.x     = self.__subContext__;
        globalThis.MLang = foam.mlang.Expressions.create();

        self.fetchTheme();
        foam.locale = localStorage.getItem('localeLanguage') || self.theme?.defaultLocaleLanguage || foam.locale;

        client.translationService.initLatch.then(() => {
          self.installLanguage();
        });

        self.onDetach(self.__subContext__.cssTokenOverrideService?.cacheUpdated.sub(self.reloadStyles));

        // group required for loginVariables before initMenu
        await self.fetchGroup();

        self.subToNotifications();
        let ret = await self.initMenu();

        // For anonymous users, we shouldn't reinstall the language
        // because the user's language setting isn't meaningful.
        if ( self?.subject?.realUser && ! ( await client.auth.isAnonymous() ) ) {
          await self.maybeReinstallLanguage(self.client);
          await self.onUserAgentAndGroupLoaded();
        }

        // add user and agent for backward compatibility
        Object.defineProperty(self, 'user', {
          get: function() {
            console.info("Deprecated use of user. Use Subject to retrieve user");
            return this.subject.user;
          },
          set: function(newValue) {
            console.warn("Deprecated use of user setter");
            this.subject.user = newValue;
          }
        });
        Object.defineProperty(self, 'agent', {
          get: function() {
            console.warn("Deprecated use of agent");
            return this.subject.realUser;
          }
        });
      });
    },

    function render() {
      this.addMacroLayout();
      this.onClientLoad();
      this.initLayout.then(() => {
        this.layoutInitialized = true;
      });
      this.window.addEventListener('resize', this.updateDisplayWidth);
      this.updateDisplayWidth();

      this.AppStyles.create();
      this.Fonts.create();
    },

    async function reloadClient() {
      this.clientReloading.pub();
      this.client = await this.ClientBuilder.create({}, this.originalSubContext).promise;
      this.__subContext__.__proto__ = this.client.__subContext__;
      // TODO: find a better way to resub on client reloads
      this.subToNotifications();
      this.fetchGroup();
      this.fetchTheme();
      this.onDetach(this.__subContext__.cssTokenOverrideService?.cacheUpdated.sub(this.reloadStyles));
      this.subject = this.client.initSubject;
    },

    function installLanguage() {
      for ( var i = 0 ; i < this.languageDefaults_.length ; i++ ) {
        var ld = this.languageDefaults_[i];
        ld[0][ld[1]] = ld[2];
      }
      this.languageDefaults_ = undefined;

      var map = this.__subContext__.translationService.localeEntries;
      for ( var key in map ) {
        try {
          var node = globalThis;
          var path = key.split('.');

          for ( var i = 0 ; node && i < path.length-1 ; i++ ) node = node[path[i]];
          if ( node ) {
            this.languageDefaults_.push([node, path[path.length-1], node[path[path.length-1]]]);
            node[path[path.length-1]] = map[key];
          }
        } catch (x) {
          console.error('Error installing locale message.', key, x);
        }
      }
    },

    async function maybeReinstallLanguage(client) {
      // Is only called if the user exists and isn't the SPID's anonymousUser
      if ( this.subject.realUser.language.toString() != foam.locale ) {
        let languages = (await client.languageDAO
          .where(foam.mlang.predicate.Eq.create({
            arg1: foam.core.auth.Language.ENABLED,
            arg2: true
          })).select()).array;

        let userPreferLanguage = languages.find(e => e.id.compareTo(this.subject.realUser.language) === 0);
        // TODO: don't update language setting for anonymous users
        // Can tell if a user is anonymous if their id === their spid's.anonymousUser
        if ( ! userPreferLanguage ) {
          foam.locale = this.defaultLanguage.toString();
          let user = this.subject.realUser;
          user.language = this.defaultLanguage.id;
          await client.userDAO.put(user);
        } else if ( foam.locale != userPreferLanguage.toString() ) {
          foam.locale = userPreferLanguage.toString();
        }
        client.translationService.maybeReload();
        await client.translationService.initLatch;
        this.installLanguage();
      }
    },

    async function fetchGroup() {
      try {
        var group = await this.client.auth.getCurrentGroup();
        if ( group == null ) throw new Error(this.GROUP_NULL_ERR);
        this.group = group;
      } catch (err) {
        // this.notify(this.GROUP_FETCH_ERR, '', this.LogLevel.ERROR, true);
        console.error(err.message || this.GROUP_FETCH_ERR);
      }
    },

    async function fetchSubject(promptLogin = true) {
      /** Get current user, else show login. */
      try {
        var result = await this.client.auth.getCurrentSubject(null);
        // If client was built for a different subject, rebuild the client
        if ( result && result.user?.id != this.subject.user?.id ) await this.reloadClient();

        promptLogin = promptLogin && await this.client.auth.check(this, 'auth.promptlogin');
        var authResult =  await this.client.auth.check(this, '*');
        if ( ! result || ! result.user || promptLogin && ! authResult ) throw new Error();
        this.fetchGroup();
      } catch (err) {
        if ( ! promptLogin || authResult ) return;
        await this.clientPromise;
        await this.requestLogin();
        return await this.fetchSubject();
      } finally {
        this.initSubject = true;
      }
    },

    function expandShortFormMacro(css, m) {
      /* A short-form macros is of the form %PRIMARY_COLOR%. */
      const M = m.toUpperCase();
      var prop = m.startsWith('DisplayWidth') ? m + '.minWidthString' : m
      var val = this.theme ? foam.util.path(this.theme, prop, false) : undefined;

      // NOTE: We add a negative lookahead for */, which is used to close a
      // comment in CSS. We do this because if we don't, then when a developer
      // chooses to include a long form CSS macro directly in their CSS such as
      //
      //                       /*%EXAMPLE%*/ #abc123
      //
      // then we don't want this method to expand the commented portion of that
      // CSS because it's already in long form. By checking if */ follows the
      // macro, we can tell if it's already in long form and skip it.
      return val ? css.replace(
        new RegExp('%' + M + '%(?!\\*/)', 'g'),
        '/*%' + M + '%*/ ' + val) : css;
    },

    function expandLongFormMacro(css, m) {
      // A long-form macros is of the form "/*%PRIMARY_COLOR%*/ blue".
      const M = m.toUpperCase();
      var prop = m.startsWith('DisplayWidth') ? m + '.minWidthString' : m
      var val = this.theme ? foam.util.path(this.theme, prop, false) : undefined;
      return val ? css.replace(
        new RegExp('/\\*%' + M + '%\\*/[^);!]*', 'g'),
        '/*%' + M + '%*/ ' + val) : css;
    },

    function wrapCSS(text, id) {
      /** CSS preprocessor, works on classes instantiated in subContext. */
      if ( ! text ) return;
      var eid = 'style' + foam.next$UID();
      this.styles[eid] = { text: text, cls: id };
      for ( var i = 0 ; i < this.MACROS.length ; i++ ) {
        const m = this.MACROS[i];
        text = this.expandShortFormMacro(this.expandLongFormMacro(text, m), m);
      }
      this.installCSS(text, id, eid);
    },

    function returnExpandedCSS(text) {
      var text2 = text;
      for ( var i = 0 ; i < this.MACROS.length ; i++ ) {
        let m = this.MACROS[i];
        text2 = this.expandShortFormMacro(this.expandLongFormMacro(text, m), m);
        text = text2;
      }
      return text;
    },

    async function pushMenu(menu, opt_forceReload) {
      // Now does a silent push, that is the menu is pushed but the route is not update
      // Use routeTo if route needs to be updated
      /** Setup **/
      let idCheck = menu && ( menu.id ? menu.id : menu );
      let currentMenuCheck = this.currentMenu?.id;
      var realMenu = menu;
      /** Used to stop any duplicating recursive calls **/
      if ( currentMenuCheck === idCheck && ! opt_forceReload ) {
        return;
      }
      /**  Used for menus that are constructed on the fly (data management, support, legal)
       * required as those menus are not put in menuDAO and hence fail the
       * find call in pushMenu_.
       * This approach allows any generated menus to be permissioned/loaded as long as
       * they are a child of a real menuDAO menu
       * **/
      if ( idCheck.includes('/') )
        realMenu = idCheck.split('/')[0];

      /** Used to checking validity of menu push and launching default on fail **/
      if ( this.client ) {
        return this.pushMenu_(realMenu, menu, opt_forceReload);
      }

      return await this.clientPromise.then(async () => {
        await this.pushMenu_(realMenu, menu, opt_forceReload);
      });
    },

    async function pushMenu_(realMenu, menu) {
      var realMenu = menu;
      dao = this.client.menuDAO;
      let stringMenu = menu && foam.String.isInstance(menu);

      // No need to check for menu in DAO if user already has access to menu obj
      if ( stringMenu ) {
        realMenu = await dao.find(menu);
      } else {
        realMenu = menu;
      }

      if ( ! realMenu ) {
        if ( ! this.loginSuccess ) {
          await this.fetchSubject();
          return;
        }
        await this.pushDefaultMenu();
        return;
      }

      if ( stringMenu && ! menu.includes('/') )
        menu = realMenu;
      this.menuListener(menu);
      await menu?.launch?.(this.__subContext__);
      return true;
    },

    async function findDefaultMenu(dao) {
      var menu;
      var menuArray = this.theme?.defaultMenu.concat(this.theme?.unauthenticatedDefaultMenu);
      if ( ! menuArray || ! menuArray.length ) return null;
      for ( menuId in menuArray ) {
        menu = await dao.find(menuArray[menuId]);
        if ( menu ) break;
      };
      return menu;
    },

    async function findFirstMenuIHavePermissionFor(dao) {
      // dao is expected to be the menuDAO
      // arg(dao) passed in cause context handled in calling function
      var maybeMenu = await this.findDefaultMenu(dao);
      if ( maybeMenu ) return maybeMenu;
      return await dao.orderBy(foam.core.menu.Menu.ORDER).limit(1)
        .select().then(a => a.array.length && a.array[0])
        .catch(e => console.error(e.message || e));
    },

    async function pushDefaultMenu() {
      var defaultMenu = await this.findDefaultMenu(this.client.menuDAO);
      defaultMenu = defaultMenu != null ? defaultMenu : '';
      if ( defaultMenu ) {
        if ( defaultMenu.authorizationStatus === this.AuthorizationStatus.AUTHENTICATED ) {
          this.routeTo(defaultMenu.id);
        } else {
          let ret = await this.pushMenu(defaultMenu.id ?? '');
          ret && (this.memento_.str = '');
        }
        return defaultMenu;
      }
      await this.fetchSubject();
    },

    function requestLogin() {
      var self = this;
      var view =  self.loginView ?? {
        ...({ class: 'foam.u2.borders.BaseUnAuthBorder' }),
         children: [ { class: 'foam.core.auth.login.LoginView', mode_: 0 } ]
      };

      // don't go to log in screen if going to reset password screen
      if ( location.hash && location.hash === '#reset' ) {
        view = {
          class: 'foam.core.auth.ChangePasswordView',
          modelOf: 'foam.core.auth.resetPassword.ResetPasswordByToken'
        };
      }

      // don't go to log in screen if going to sign up password screen
      if ( location.hash && location.hash === '#sign-up' && ! self.loginSuccess ) {
        view = {
          ...(self.loginView ?? { class: 'foam.u2.borders.BaseUnAuthBorder' }),
            children: [ { class: 'foam.core.auth.login.LoginView', mode_: 1 } ]
        };
      }

      return new Promise(function(resolve, reject) {
        self.stack.set(view, self);
        self.loginSuccess$.sub(resolve);
      });

    },

    async function login(identifier, password) {
      await this.client.auth.login(this, identifier, password);
      await this.fetchSubject();
      await this.onUserAgentAndGroupLoaded();
    },

    function notify(toastMessage, toastSubMessage, severity, transient=true, icon) {
      if ( transient ) {
        this.add(this.NotificationMessage.create({
          err: toastMessage.exception,
          message: toastMessage.exception ? '' : toastMessage,
          description: toastSubMessage,
          type: severity,
          icon: icon
        }));
      } else {
        var notification = this.Notification.create();
        notification.userId = this.subject && this.subject.realUser ?
          this.subject.realUser.id : this.user && this.user.id || 0;
        notification.toastMessage    = toastMessage;
        notification.toastSubMessage = toastSubMessage;
        notification.toastState      = this.ToastState.REQUESTED;
        notification.severity        = severity || this.LogLevel.INFO;
        notification.transient       = transient;
        notification.icon            = icon;
        var dao = notification.userId == 0 ?
            this.__subContext__.notificationDAO : this.__subContext__.myNotificationDAO || this.__subContext__.notificationDAO;
        dao.put(notification);
      }
    },

    function displayToastMessage(sub, on, put, obj) {
      if ( obj.toastState == this.ToastState.REQUESTED ) {
        this.add(this.NotificationMessage.create({
          message: obj.toastMessage,
          type: obj.severity,
          description: obj.toastSubMessage,
          icon: obj.icon
        }));
        // only update and save non-transient messages
        if ( ! obj.transient ) {
          var clonedNotification = obj.clone();
          clonedNotification.toastState = this.ToastState.DISPLAYED;
          this.__subContext__.notificationDAO.put(clonedNotification);
        }
      }
    }
  ],

  listeners: [
    async function onUserAgentAndGroupLoaded() {
      /**
       * Called whenever the group updates.
       *   - Updates the portal view based on the group
       *   - Update the look and feel of the app based on the group or user
       *   - Go to a menu based on either the hash or the group
       */
      this.subToNotifications();

      this.loginSuccess = true;
      let check = await this.checkGeneralCapability();
      if ( ! check ) return;
      await this.fetchTheme();
      var hash = this.window.location.hash;
      if ( hash ) hash = hash.substring(1);
      if ( ! hash || hash == 'null' /* How does it even get set to null? */ ) {
        await this.pushDefaultMenu();
      } else if ( hash != this.currentMenu?.id || this.currentMenu.authorizationStatus !== this.AuthorizationStatus.PUBLIC ) {
        this.routeUpdated()
      }
      this.initLayout.resolve();

//      this.__subContext__.localSettingDAO.put(foam.core.session.LocalSetting.create({id: 'homeDenomination', value: localStorage.getItem("homeDenomination")}));
    },

    // TODO: simplify in NP-8928
    async function checkGeneralCapability() {
      var groupDAO = this.__subContext__.groupDAO;
      if ( ! this.subject.realUser || ! groupDAO ) return false;
      var group = await groupDAO.find(this.subject.realUser.group);

      if ( ! group || ! group.generalCapability ) return true;

      const ucjCheck = async () => await this.__subContext__.crunchService.getJunction(null, group.generalCapability);
      var ucj = await ucjCheck();
      if ( ucj != null && ucj.status == this.CapabilityJunctionStatus.GRANTED ) {
        return true;
      }

      const wizardRunner = this.WizardRunner.create({
        wizardType: this.WizardType.UCJ,
        source: group.wizardFlow || group.generalCapability,
        options: {inline: false, returnCompletionPromise: true}
      });
      wizardRunner.sequence.remove('ReturnToLaunchPointAgent');
      // TODO: figure out why this cant be inlined
      let retPromise = await wizardRunner.launch();
      await retPromise;
      return await this.doGeneralCapabilityPostCheck(ucjCheck);
    },

    async function doGeneralCapabilityPostCheck (ucjCheck) {
      this.__subContext__.userCapabilityJunctionDAO.cmd_(this, foam.dao.DAO.PURGE_CMD);
      this.__subContext__.userCapabilityJunctionDAO.cmd_(this, foam.dao.DAO.RESET_CMD);
      let postCheck = await ucjCheck();
      if ( postCheck == null || postCheck.status != this.CapabilityJunctionStatus.GRANTED ) {
        let popup = foam.u2.dialog.ConfirmationModal.create({
          title: this.GC_ERROR_TITLE,
          modalStyle: 'DESTRUCTIVE',
          primaryAction: { name: 'close', code: () => this.pushMenu('sign-out') },
          closeable: false,
          showCancel: false
        }, this)
          .start()
          .style({ 'min-width': '25vw'})
          .add(this.GC_ERROR)
          .end();
        popup.open();
        return false;
      } else {
        this.__subContext__.menuDAO.cmd_(this, foam.dao.DAO.PURGE_CMD);
        this.__subContext__.menuDAO.cmd_(this, foam.dao.DAO.RESET_CMD);
        this.__subContext__.googleTagAgent?.pub('userOnboarded');
        await this.reloadClient();
        return true;
      }
    },

    function addMacroLayout() {
      var theme = this.document.querySelector(`meta[name='theme-color']`);
      var color = theme ? theme.getAttribute('content') : 'red';
      this
        .addClass(this.myClass())
        .tag(this.NavigationController, {
          topNav$: this.topNavigation_$,
          mainView$: this.stack$,
          footer$: this.footerView_$,
          sideNav$: this.sideNav_$
        });
    },

    function subToNotifications() {
      let unsub = () => { this.notificationSub?.detach(); this.notificationSub = undefined; }
      if ( this.notificationSub ) unsub();
      this.notificationSub =  this.__subContext__.myNotificationDAO?.on.put.sub(this.displayToastMessage.bind(this));
      this.clientReloading.sub(unsub);
    },

    function menuListener(m) {
      /**
       * This listener should be called when a Menu item has been launched
       * by some Menu View. Is exported.
       */
      this.currentMenu = m;
    },

    function lastMenuLaunchedListener(m) {
      /**
       * This listener should be called when a Menu has been launched but does
       * not navigate to a new screen. Typically for SubMenus.
       */
      this.lastMenuLaunched = m;
    },

    function fetchTheme() {
      /**
       * Get the most appropriate Theme object from the server and use it to
       * customize the look and feel of the application.
       */
      var lastTheme = this.theme;
      try {
        this.theme = this.__subContext__.theme;
        this.appConfig.copyFrom(this.theme.appConfig);
      } catch (err) {
        this.notify(this.LOOK_AND_FEEL_NOT_FOUND, '', this.LogLevel.ERROR, true);
        console.error(err);
        return;
      }

      if ( ! lastTheme || ! lastTheme.equals(this.theme) ) this.useCustomElements();
    },

    function useCustomElements() {
      /** Use custom elements if supplied by the Theme. */
      if ( ! this.theme )
        throw new Error(this.LOOK_AND_FEEL_NOT_FOUND);

      if ( this.theme.topNavigation )
        this.topNavigation_ = this.theme.topNavigation;

      if ( this.theme.footerView )
        this.footerView_ = this.theme.footerView;

      if ( this.theme.sideNav )
        this.sideNav_ = this.theme.sideNav;
      if ( this.theme.loginView )
        this.loginView = this.theme.loginView;
    },
    {
      name: 'updateDisplayWidth',
      isFramed: true,
      code: function() {
        this.displayWidth = foam.u2.layout.DisplayWidth.VALUES
          .concat()
          .sort((a, b) => b.minWidth - a.minWidth)
          .find(o => o.minWidth <= Math.min(this.window.innerWidth, this.window.screen.width) );
      }
    },
    function replaceStyleTag(text, eid) {
      if ( ! text ) return;
      text = this.returnExpandedCSS(text);
      this.styles[eid].text = text;
      const el = this.getElementById(eid);
      if ( text !== el?.textContent )
        el.textContent = text;
    },
    {
      name: 'reloadStyles',
      isMerged: true,
      mergeDelay: 500,
      code: function() {
        for ( const eid in this.styles ) {
          const style = this.styles[eid];
          text = foam.CSS.replaceTokens(style.text, style.cls, this.__subContext__, this.THEME_OVERRIDE_REGEXP);
          this.replaceStyleTag(text, eid);
        }
      }
    },
    {
      name: 'routeUpdated',
      on: ['this.propertyChange.route'],
      code: function() {
        // only pushmenu on route change after the fetchsubject process has been initiated
        // as the init process will also check the route and pushmenu if required
        if (this.initSubject) {
          this.route ? this.pushMenu_(null, this.route) : this.pushDefaultMenu();
        }
      }
    },
    function routeTo(link) {
      /**
       * Replaces the url to redirect to the new menu without cleared tails
       */
      this.window.location.hash = link;
    },
    async function routeToDAO(dao, id) {
      // Check if current menu has object
      if ( id && foam.core.menu.DAOMenu2.isInstance(this.currentMenu.handler)
        // Going to a reference from the current menu is not where we need to go - so check if the current menu is the correct menu
        && this.currentMenu.handler.config.daoKey == dao.serviceName.split('/')[1] ) {
        try {
          let result = await this.currentMenu.handler.config_.dao.find(id);
          if ( result ) {
            this.routeTo(this.currentMenu.id + '/' + id);
            return;
          }
        } catch(e) {}
      }
      // Finds the correct menu for a given dao and optionally an object
      let menuDAOs = (await this.__subContext__.menuDAO.select())
        .array?.filter(v => foam.core.menu.DAOMenu2.isInstance(v.handler));
      menuDAOs = menuDAOs.filter(m => m.handler.config_.dao.of?.isSubClass(dao.of) );
      if ( ! id ) {
        return this.routeTo(menuDAOs[0].id);
      }
      for ( var i = 0; i < menuDAOs.length; i++ ) {
        var result = await menuDAOs[i].handler.config_.dao.find(id);
        if ( result ) {
          this.routeTo(menuDAOs[i].id + (id ? '/' + id : ''))
          return;
        }
          // TODO: add support for being able to pick if multiple menus have the same obj
          // menus.push(menuDAOs[i]);
      }
      console.error('No menu found for dao', dao, id);
    },
    function logAnalyticEvent(evt) {
      this.__subContext__.analyticEventDAO?.put(this.AnalyticEvent.create(evt), this);
    }
  ]
});
