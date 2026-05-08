/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ReadReferenceView',
  extends: 'foam.u2.View',
  axioms: [foam.pattern.Faceted.create()],

  imports: [
    'auth',
    'ctrl',
    'menuDAO',
    'pushMenu',
    'stack',
    'routeTo',
    'routeToDAO'
  ],

  requires: [
    'foam.comics.v2.DAOControllerConfig',
    'foam.u2.detail.SectionedDetailView',
    'foam.u2.stack.StackBlock',
    'foam.u2.view.ReferenceCitationView'
  ],

  documentation: `
    A read-only view for a reference property that creates a link on this reference property.

    -- How to configure the link --
        - Use enableLink and menuKeys to configure the link.
          - To disable the link, set enableLink to false.
          - To set the link to a custom menu, you can provide a list of menus to 'menuKeys'. The first menu
            with permission in the list will be set to the link. If no menus are permissioned, the link will
            be disabled.
          - If enableLink and menuKeys are not set, the link will be set to dao summary view if you have
            service.{prop.targetDaoKey}. Otherwise, the link will be disabled.
        - Flow chart for how the links are set

                                                      enableLink is
                                                      set to true ?
                                                      /          \
                                                   y /            \ n
                                                    /              \
                                              - - -                 - - - - - - - - - - - - - -
                                            /                                                  \
                                      menus provided ?                                      disable link
                                        /      \   n
                                     y /         - - - - - - - - - - - - - - - - -
                                      /                                            \
                              have a menu with                            have permission to
                                permission ?                          service.{prop.targetDAOKey}?
                                 /       \   n                                   /     \     n
                              y /          - - - - - -                        y /        - - - - -
                               /                       \                       /                   \
                    Is the menu dao Menu and      disable link           enable link           disable link
                    dao Menu daoKey matches                           link to daoSummary
                    prop.targetDAOKey ?
                        /      \  n
                     y /        - - - - - -
                      /                     \
                enable link            enable link
              link to daoSummary     link to the menu

    -- Where to set enableLink and menuKeys --
        - enableLink and menuKeys can be set directly to reference property or
          they can be passed to the view.
          Warning: Do not try to do both or it may result in unexpected behaviours.

        1. setting properties on reference property

        {
          class: 'Reference',
          of: 'foam.core.auth.Group',
          name: 'group',
          menuKeys: [
            'someMenuId',
            'someMenuId2'
          ]
        }

        2. passing properties to view

        class: 'Reference',
        of: 'foam.core.auth.Group',
        name: 'group',
        view: {
          class: 'foam.u2.view.ReadReferenceView',
          menuKeys: [
            'someMenuId',
            'someMenuId2'
          ]
        }
  `,

  properties: [
    'obj',
    {
      name: 'of',
      expression: function (obj) {
        return obj?.cls_ || null;
      }
    },
    'prop',
    {
      class: 'String',
      name: 'linkTo',
      documentation: `
        A reference view anchor link.
        This will be set to either 'daoSummary', a menu in menuKeys, or an empty string.
        If set to 'daoSummary', the link will be to reference property's dao summary view.
        If set to a menu, the link will be to this menu.
        If set to an empty string, the link will be disabled.
      `
    },
    {
      class: 'Boolean',
      name: 'enableLink',
      documentation: `
        Create the reference view as an anchor link to the reference's DetailView or provided menu.
      `,
      value: true
    },
    {
      name: 'menuKeys',
      documentation: `
        A list of menu ids.
        The link will reference to the first menu to which you have permission
        in this list. If no menus are permissioned, the link will be disabled.
      `
    }
  ],

  methods: [
    {
      name: 'render',
      code: function() {
        this.SUPER();
        var self = this;
        this.data$.sub(() => {
          this.enableLink = true;
          this.configLink();
        })
        this.add(this.slot(function(obj, enableLink) {
            if ( ! obj ) return '';

            if ( ! this.enableLink ) {
              return this.E().tag(self.ReferenceCitationView, { data: obj });
            }

            return this.E()
              .start('a')
                .attrs({ href: '#' })
                .on('click', (evt) => {
                  evt.preventDefault();
                  if ( self.linkTo == 'daoSummary' ) {
                    this.routeToDAO(this.__subContext__[this.prop.targetDAOKey], this.obj?.id)
                  } else if ( self.linkTo.includes('/') ) {
                    this.routeTo('#' + this.linkTo);
                  } else {
                    self.pushMenu(self.linkTo);
                  }
                })
                .tag(self.ReferenceCitationView, { data: obj })
              .end();
          })
        );
      }
    },

    function fromProperty(prop) {
      this.SUPER(prop);

      this.prop = prop;

      // set link config properties
      // first figure out where these properties were provided (i.e., set to reference property or passed to this view)
      this.enableLink = this.prop.enableLink && this.enableLink;
      this.menuKeys   = this.prop.menuKeys || this.menuKeys;

      this.configLink();
    },

    async function configLink() {
      const dao = this.ctrl.__subContext__[this.prop.targetDAOKey];
      if ( dao ) {
        this.obj = await dao.find(this.data);
      }
      if ( ! this.obj ) {
        console.warn('***********No valid reference obj')
        this.enableLink = false;
        return;
      }
      // enableLink set to false?
      if ( ! this.enableLink ) {
        this.enableLink = false;
        return;
      }

      try {
        // menus are provided?
        if ( this.menuKeys ) {
          // check permissions for menus
          const availableMenus = await Promise.all(
            this.menuKeys.map(menuId => this.menuDAO.find(menuId))
          );

          for ( const maybeMenu of availableMenus ) {
            if ( ! maybeMenu ) continue;

            let configuredDAOKey = maybeMenu?.handler?.config?.daoKey;
            this.linkTo = (
              configuredDAOKey &&
              configuredDAOKey === this.prop.targetDAOKey
            ) ? `${maybeMenu.id}/${this.obj.id}` : maybeMenu.id;

            await this.maybeEnableLink();
            return;
          }
        }

        // have permission to service.{prop.targetDAOKey} ?
        else if ( this.__subContext__[this.prop.targetDAOKey] ) {
          this.linkTo = 'daoSummary';
          await this.maybeEnableLink();
          return;
        }

        this.enableLink = false;
      } catch (e) {
        console.error(e);
        this.enableLink = false;
      }
    },

    async function maybeEnableLink() {
      if ( this.linkTo !== 'daoSummary' ) {
        this.enableLink = true;
        return;
      }
      var p = `referenceDetailView.${this.of?.id ?? 'unknown'}`;
      this.enableLink = await this.auth.check(
        null, p);
    }
  ]
});
