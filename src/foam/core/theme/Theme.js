/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.theme',
  name: 'Theme',

  documentation: `
    An object that specifies how the web app should look and feel. Anything that
    relates to appearance or behaviour that can be configured should be stored
    here.
  `,

  implements: [
    'foam.core.auth.Authorizable',
    'foam.core.auth.CreatedAware',
    // REVIEW: implementation properties are class: 'Long' as we have a cyclic reference with User, and hence can't use class: 'Reference'. But even as Long, enable these interfaces causes genjava failures: ERROR: Unhandled promise rejection TypeError: Cannot read property 'id' of null
    // 'foam.core.auth.CreatedByAware',
    'foam.core.auth.EnabledAware',
    'foam.core.auth.LastModifiedAware',
    // 'foam.core.auth.LastModifiedByAware',

    // NOTE: This model cannot implement the ServiceProviderAware interface as it itself
    // is used during ServiceProviderAwareDAO operations as a fallback to determine the
    // spid based on url and theme.
    // 'foam.core.auth.ServiceProviderAware'
  ],

  requires: [
    'foam.core.auth.PasswordPolicy',
    'foam.u2.theme.ThemeGlyphs',
    'foam.u2.layout.DisplayWidth'
  ],

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.AuthService',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.util.SafetyUtil',
    'java.util.Arrays',
    'java.util.HashSet',
    'java.util.List',
    'java.util.Map'
  ],

  tableColumns: [
    'enabled',
    'name',
    'description',
    'domains',
    'preview'
  ],

  sections: [
    {
      name: 'infoSection',
      title: 'Info'
    },
    {
      name: 'urlMapping',
      title: 'URL Mapping'
    },
    {
      name: 'colours',
      title: 'Colours'
    },
    {
      name: 'images',
      title: 'Icons / Images'
    },
    {
      name: 'sectionCss',
      title: 'CSS'
    },
    {
      name: 'navigation',
      title: 'Navigation'
    },
    {
      name: 'inputs',
      title: 'Inputs'
    },
    {
      name: 'applicationSection',
      title: 'Application'
    },
    {
      name: 'administration'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'id',
      includeInDigest: true,
      section: 'infoSection',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'name',
      section: 'infoSection',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'registrationGroup',
      shortName: 'rg',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'description',
      shortName: 'd',
      section: 'infoSection',
      writePermissionRequired: true
    },
    {
      class: 'Boolean',
      name: 'enabled',
      value: true,
      includeInDigest: true,
      section: 'administration',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'appName',
      section: 'infoSection',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'appController',
      section: 'applicationSection',
      documentation: 'Fully qualified FOAM class name for the application controller (e.g., kaos.ZAC).',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'bootservices',
      section: 'applicationSection',
      documentation: 'Comma-separated boot services to instantiate (e.g., cookbookZACClient).',
      writePermissionRequired: true
    },
    {
      class: 'StringArray',
      name: 'domains',
      factory: function() {
        return  ['localhost'];
      },
      javaFactory: 'return new String[] { "localhost" };',
      includeInDigest: true,
      section: 'urlMapping',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'navigationRootMenu',
      shortName: 'nrm',
      documentation: 'Specifies the root menu to be used in side navigation.',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'settingsRootMenu',
      shortName: 'srm',
      documentation: 'Specifies the root menu to be used in top navigation settings drop-down.',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'logoRedirect',
      writePermissionRequired: true
    },
    {
      class: 'StringArray',
      name: 'defaultMenu',
      shortName: 'dm',
      documentation: 'Menu user redirects to after login.',
      section: 'navigation',
      view: {
        class: 'foam.u2.view.ReferenceArrayView',
        daoKey: 'menuDAO',
        allowDuplicates: false
      },
      writePermissionRequired: true
    },
    {
      class: 'Reference',
      targetDAOKey: 'menuDAO',
      name: 'unauthenticatedDefaultMenu',
      shortName: 'udm',
      documentation: 'Menu user redirects to before login.',
      of: 'foam.core.menu.Menu',
      section: 'navigation',
      writePermissionRequired: true
    },
    {
      documentation: 'See LocaleSupport for default fallback',
      class: 'String',
      name: 'defaultLocaleLanguage',
      writePermissionRequired: true
    },
    {
      class: 'Map',
      name: 'headConfig',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'loginView',
      documentation: `Border used to wrap unauthenticated views like loginViews. Set to nullBorder for no additional borders`,
    },
// NOTES:
//      value:        // with no value - then left image and right login view
//      value: 'foam.core.auth.login.LoginView'  // just right login view
//      value: 'foam.u2.borders.BaseUnAuthBorder' // just left image
    {
      class: 'Image',
      name: 'logo',
      documentation: 'The logo to display in the application.',
      displayWidth: 60,
      view: {
        class: 'foam.u2.MultiView',
        views: [
          {
            class: 'foam.u2.tag.TextArea',
            rows: 4, cols: 80
          },
          { class: 'foam.u2.view.ImageView' },
        ]
      },
      section: 'images',
      writePermissionRequired: true
    },
    {
      class: 'Image',
      name: 'largeLogo',
      documentation: 'A large logo to display in the application.',
      factory: function() {
        return this.logo;
      },
      displayWidth: 60,
      view: {
        class: 'foam.u2.MultiView',
        views: [
          {
            class: 'foam.u2.tag.TextArea',
            rows: 4, cols: 80
          },
          { class: 'foam.u2.view.ImageView' },
        ]
      },
      section: 'images',
      writePermissionRequired: true
    },
    {
      class: 'Boolean',
      name: 'shouldResizeLogo',
      documentation: 'Enables switching between largeLogo and logo in ApplicationLogoView'
    },
    {
      class: 'Image',
      name: 'loginImage',
      displayWidth: 60,
      view: {
        class: 'foam.u2.MultiView',
        views: [
          {
            class: 'foam.u2.tag.TextArea',
            rows: 4, cols: 80
          },
          { class: 'foam.u2.view.ImageView' },
        ]
      },
      section: 'images',
      writePermissionRequired: true
    },
    {
      class: 'Image',
      name: 'externalCommunicationImage',
      factory: function() {
        return this.logo;
      },
      displayWidth: 60,
      view: {
        class: 'foam.u2.MultiView',
        views: [
          {
            class: 'foam.u2.tag.TextArea',
            rows: 4, cols: 80
          },
          { class: 'foam.u2.view.ImageView' },
        ]
      },
      section: 'images',
      writePermissionRequired: true
    },
    {
      class: 'Image',
      name: 'topNavLogo',
      displayWidth: 60,
      factory: function() {
        return this.largeLogoEnabled ? this.largeLogo : this.logo;
      },
      view: {
        class: 'foam.u2.MultiView',
        views: [
          {
            class: 'foam.u2.tag.TextArea',
            rows: 4, cols: 80
          },
          { class: 'foam.u2.view.ImageView' },
        ]
      },
      section: 'images',
      writePermissionRequired: true
    },
    {
      class: 'Boolean',
      name: 'largeLogoEnabled',
      documentation: 'Uses largeLogo image on various views instead of logo.',
      section: 'images',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'logoBackgroundColour',
      documentation: 'The logo background colour to display in the application.',
      section: 'images',
      writePermissionRequired: true
    },
    {
      class: 'FObjectProperty',
      of: 'foam.u2.theme.ThemeGlyphs',
      name: 'glyphs',
      documentation: 'Glyphs are simple vectors which can be used as menu items or indicators.',
      factory: function () {
        return this.ThemeGlyphs.create();
      },
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'topNavigation',
      documentation: 'A custom top nav view to use.',
      value: 'foam.core.u2.navigation.ResponsiveTopNav',
      displayWidth: 45,
      section: 'navigation',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'footerView',
      documentation: 'A custom footer view to use.',
      value: 'foam.core.u2.navigation.FooterView',
      displayWidth: 45,
      section: 'navigation',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'sideNav',
      documentation: 'A custom footer view to use.',
      value: `{
        "class": "foam.u2.view.ResponsiveAltView",
        "views": [
          [{"class": "foam.core.u2.navigation.ApplicationSideNav"}, ["XS"]],
          [{"class": "foam.core.menu.VerticalMenu" }, ["MD"] ]
        ]
      }`,
      displayWidth: 45,
      section: 'navigation',
      writePermissionRequired: true
    },
    {
      class: 'Code',
      name: 'customCSS',
      section: 'sectionCss',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'font1',
      section: 'sectionCss',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'primary1',
      shortName: 'p1',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'primary2',
      shortName: 'p2',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'primary3',
      shortName: 'p3',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'primary4',
      shortName: 'p4',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'primary5',
      shortName: 'p5',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'secondary1',
      shortName: 's1',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'secondary2',
      shortName: 's2',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'secondary3',
      shortName: 's3',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'secondary4',
      shortName: 's4',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'secondary5',
      shortName: 's5',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'approval1',
      shortName: 'a1',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'approval2',
      shortName: 'a2',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'approval3',
      shortName: 'a3',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'approval4',
      shortName: 'a4',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'approval5',
      shortName: 'a5',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'warning1',
      shortName: 'w1',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'warning2',
      shortName: 'w2',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'warning3',
      shortName: 'w3',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'warning4',
      shortName: 'w4',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'warning5',
      shortName: 'w5',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'destructive1',
      shortName: 'd1',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'destructive2',
      shortName: 'd2',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'destructive3',
      shortName: 'd3',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'destructive4',
      shortName: 'd4',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'destructive5',
      shortName: 'd5',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'grey1',
      shortName: 'g1',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'grey2',
      shortName: 'g2',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'grey3',
      shortName: 'g3',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'grey4',
      shortName: 'g4',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'grey5',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'black',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'Color',
      name: 'white',
      section: 'colours',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'inputHeight',
      documentation: 'Used to enforce consistent height across text-based inputs.',
      section: 'inputs',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'inputVerticalPadding',
      shortName: 'ivp',
      section: 'inputs',
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'inputHorizontalPadding',
      shortName: 'ihp',
      section: 'inputs',
      writePermissionRequired: true
    },
    {
      class: 'foam.lang.FObjectProperty',
      name: 'appConfig',
      of: 'foam.core.app.AppConfig',
      section: 'applicationSection',
      factory: function() { return foam.core.app.AppConfig.create({}); },
      writePermissionRequired: true
    },
    {
      class: 'Long',
      name: 'createdBy',
      includeInDigest: true,
      documentation: `The unique identifier of the user.`,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      tableCellFormatter: function(value, obj, axiom) {
        this.__subSubContext__.userDAO
          .find(value)
          .then((user) => {
            if ( user ) {
              this.add(user.legalName);
            }
          })
          .catch((error) => {
            this.add(value);
          });
      },
      section: 'administration',
      writePermissionRequired: true
    },
    {
      class: 'Long',
      name: 'createdByAgent',
      visibility: 'HIDDEN',
      writePermissionRequired: true
    },
    {
      class: 'DateTime',
      name: 'created',
      includeInDigest: true,
      documentation: 'The date and time the User was last modified.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      section: 'administration',
      writePermissionRequired: true
    },
    {
      class: 'Long',
      name: 'lastModifiedBy',
      includeInDigest: true,
      documentation: `The unique identifier of the user.`,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      tableCellFormatter: function(value, obj, axiom) {
        this.__subSubContext__.userDAO
          .find(value)
          .then((user) => {
            if ( user ) {
              this.add(user.legalName);
            }
          })
          .catch((error) => {
            this.add(value);
          });
      },
      section: 'administration'
    },
    {
      class: 'Long',
      name: 'lastModifiedByAgent',
      includeInDigest: true,
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      tableCellFormatter: function(value, obj, axiom) {
        this.__subSubContext__.userDAO
          .find(value)
          .then((user) => {
            if ( user ) {
              this.add(user.legalName);
            }
          })
          .catch((error) => {
            this.add(value);
          });
      },
      section: 'administration'
    },
    {
      class: 'DateTime',
      name: 'lastModified',
      includeInDigest: true,
      documentation: 'The date and time the User was last modified.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      section: 'administration'
    },
    {
      name: 'spid',
      class: 'Reference',
      of: 'foam.core.auth.ServiceProvider',
      writePermissionRequired: true
    },
    {
      class: 'foam.lang.FObjectProperty',
      of:'foam.core.app.SupportConfig',
      name: 'supportConfig',
      factory: function() { return foam.core.app.SupportConfig.create({}, this)},
      javaFactory: `
        return new foam.core.app.SupportConfig();
      `,
      writePermissionRequired: true
    },
    {
      class: 'String',
      name: 'customRefinement',
      displayWidth: 80,
      writePermissionRequired: true
    },
    {
      class: 'Boolean',
      name: 'allowDuplicateEmails',
      section: 'administration',
      value: false,
      writePermissionRequired: true
    },
    {
      class: 'FObjectProperty',
      of: 'foam.core.auth.PasswordPolicy',
      name: 'passwordPolicy',
      documentation: 'Password policy for this group.',
      factory: function() {
        return this.PasswordPolicy.create();
      },
      javaFactory: `
        return new foam.core.auth.PasswordPolicy(getX());
      `,
      view: {
        class: 'foam.u2.view.FObjectPropertyView',
        readView: { class: 'foam.u2.detail.VerticalDetailView' }
      },
      includeInDigest: true,
      writePermissionRequired: true
    },
    {
      class: 'Array',
      name: 'restrictedCapabilities',
      documentation: `
        List of capabilities whose entries should be ignored when querying capabilityDAO.
      `,
      javaPostSet: `
        Object[] caps = getRestrictedCapabilities();
        if ( caps != null && caps.length > 0 ) {
          setRestrictedCapabilities_(new HashSet<>(Arrays.asList(caps)));
        } else {
          setRestrictedCapabilities_(new HashSet());
        }
      `,
      writePermissionRequired: true
    },
    {
      class: 'Object',
      name: 'restrictedCapabilities_',
      transient: true,
      javaType: 'java.util.HashSet',
      javaFactory: `
        return new HashSet<>();
      `,
      hidden: true
    },
    {
      class: 'Boolean',
      name: 'showNavSearch',
      value: true
    },
    {
      class: 'String',
      name: 'emailLinkRedirect',
      javaValue: `"/"`
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.menu.XRegistration',
      documentation: `Allows for class overrides on a theme basis. Ex.
      "registrations":[
        {
          "class":"foam.core.menu.XRegistration",
          "className":"foam.u2.DetailView",
          "targetName":"foam.u2.PropertyBorder"
        }
      ]
      The above code if added to a theme jrl will replace all instances of 'foam.u2.PropertyBorder' with 'foam.u2.DetailView' when that theme is being used by a client.
      `,
      name: 'registrations'
    },
    // TODO: Move to a CSpec instead when CSpec exports are fixed
    {
      name: 'activeVariants',
      class: 'Map',
      factory: function() {
        return {};
      }
    },
    {
      // Set to true when dark mode is cleared for prod
      name: 'useVariants',
      class: 'Boolean'
    }
  ],

  actions: [
    {
      name: 'preview',
      tableWidth: 100,
      code: function(X) {
        X.ctrl.theme = this;
      },
      section: 'infoSection'
    }
  ],

  methods: [
    {
      name: 'authorizeOnCreate',
      args: 'X x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "theme.create.*") ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'authorizeOnRead',
      args: 'X x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
      // global read
      `
    },
    {
      name: 'authorizeOnUpdate',
      args: 'X x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( auth.check(x, "theme.update."+ this.getId()) ) return;
        User user = ((Subject) x.get("subject")).getUser();
        if ( user != null &&
             user.getSpid().equals(this.getSpid()) )  return;

        throw new AuthorizationException();
     `
    },
    {
      name: 'authorizeOnDelete',
      args: 'X x',
      javaThrows: ['AuthorizationException'],
      javaCode: `
        AuthService auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "theme.remove."+ this.getId()) ) {
          throw new AuthorizationException();
        }
      `
    },
    {
      name: 'toSummary',
      type: 'String',
      code: function() {
        return this.name + ' ' + this.description;
      },
      javaCode: `
        return foam.util.SafetyUtil.isEmpty(getName()) || foam.util.SafetyUtil.isEmpty(getDescription()) ? "" : getName() + " " + getDescription();
      `
    },
    {
      name: 'merge',
      type: 'Theme',
      args: [ 'Theme other' ],
      code: function(other) {
        var theme = this.clone();
        var props = this.cls_.getAxiomsByClass(foam.lang.Property);
        for ( var i = 0 ; i < props.length ; i++ ) {
          var name = props[i].name;
          if ( ! other.hasOwnProperty(name) ) continue;

          if ( foam.lang.StringArray.isInstance(props[i])          ) this.mergeArrayProperty(props[i], theme, other);
          else if ( foam.lang.Map.isInstance(props[i])             ) this.mergeMapProperty(props[i], theme, other);
          else if ( foam.lang.FObjectProperty.isInstance(props[i]) ) this.mergeFObjectProperty(props[i], theme, other);
          else theme[name] = other[name];
        }
        return theme;
      },
      javaCode: `
        var theme = (Theme) this.fclone();
        List<PropertyInfo> props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
        for ( PropertyInfo p : props ) {
          if ( ! p.isSet(other) ) continue;

          if ( p.getValueClass().isArray()                            ) mergeArrayProperty(p, theme, other);
          else if ( Map.class.isAssignableFrom(p.getValueClass())     ) mergeMapProperty(p, theme, other);
          else if ( FObject.class.isAssignableFrom(p.getValueClass()) ) mergeFObjectProperty(p, theme, other);
          else p.set(theme, p.get(other));
        }
        return theme;
      `
    },
    {
      name: 'mergeArrayProperty',
      args: [ 'PropertyInfo prop', 'Theme t1', 'Theme t2' ],
      code: function(prop, t1, t2) {
        var name = prop.name;

        if ( ! t1.hasOwnProperty(name) ) t1[name] = t2[name];
        else if ( prop.compare(t1, t2) != 0 ) {
          t1[name].push(...t2[name]);
        }
      },
      javaCode: `
        if ( ! prop.isSet(t1) ) prop.set(t1, prop.get(t2));
        else if ( prop.compare(t1, t2) != 0 ) {
          var value1 = (Object[]) prop.get(t1);
          var value2 = (Object[]) prop.get(t2);

          if ( value2 == null ) return;
          if ( value1 == null ) {
            prop.set(t1, value2);
            return;
          }

          Object[] merged = new Object[value1.length + value2.length];
          System.arraycopy(value1, 0, merged, 0, value1.length);
          System.arraycopy(value2, 0, merged, value1.length, value2.length);
          prop.set(t1, merged);
        }
      `
    },
    {
      name: 'mergeMapProperty',
      args: [ 'PropertyInfo prop', 'Theme t1', 'Theme t2' ],
      code: function(prop, t1, t2) {
        var name = prop.name;

        if ( ! t1.hasOwnProperty(name) ) t1[name] = t2[name];
        else if ( prop.compare(t1, t2) != 0 ) {
          Object.assign(t1[name], t2[name]);
        }
      },
      javaCode: `
        if ( ! prop.isSet(t1) ) {
          prop.set(t1, prop.get(t2));
        } else if ( prop.compare(t1, t2) != 0 ) {
          var m1 = (Map) prop.get(t1);
          var m2 = (Map) prop.get(t2);

          if ( m2 == null ) return;
          if ( m1 == null ) {
            prop.set(t1, m2);
            return;
          }

          for ( var k : m2.keySet() ) {
            m1.put(k, m2.get(k));
          }
        }
      `
    },
    {
      name: 'mergeFObjectProperty',
      args: [ 'PropertyInfo prop', 'Theme t1', 'Theme t2' ],
      code: function(prop, t1, t2) {
        var name = prop.name;

        if ( ! t1.hasOwnProperty(name) ) t1[name] = t2[name];
        else if ( prop.compare(t1, t2) != 0 &&
                  prop.compare(t2, foam.core.theme.Theme.create({}, this)) != 0 ) {
          t1[name].copyFrom(t2[name]);
        }
      },
      javaCode: `
        if ( ! prop.isSet(t1) ) {
          prop.set(t1, prop.get(t2));
        } else if ( prop.compare(t1, t2) != 0 && prop.isSet(t2) ) {
          var value1 = (FObject) prop.get(t1);
          var value2 = (FObject) prop.get(t2);

          if ( value2 == null ) return;
          if ( value1 == null ) {
            prop.set(t1, value2);
            return;
          }

          value1.copyFrom(value2);
        }
      `
    },
    {
      name: 'isCapabilityRestricted',
      type: 'Boolean',
      args: [ 'String capId' ],
      code: function(capId) {
        if ( this.restrictedCapabilities != null ) {
          return this.restrictedCapabilities.includes(capId)
        }
        return false;
      },
      javaCode: `
        if ( getRestrictedCapabilities() != null ) {
          return getRestrictedCapabilities_().contains(capId);
        }
        return false;
      `
    }
  ]
});
