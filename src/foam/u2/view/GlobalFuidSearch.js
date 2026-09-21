/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'GlobalFuidSearch',
  extends: 'foam.u2.view.SuggestedTextField',

  requires: [
    'foam.lang.Action',
    'foam.core.menu.Menu',
    'foam.u2.FUIDAutocompleter',
    'foam.u2.md.OverlayDropdown',
    'foam.u2.stack.StackBlock'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  imports: [
    'stack',
    'ctrl'
  ],

  css:
  `
    ^suggestions {
      background-color: $backgroundSecondary;
      border: none;
      position: relative;
    }
    ^suggestions > * + * {
      margin-top: 8px;
    }
    ^row {
      background-color: $backgroundSecondary;
      cursor: pointer;
      padding: 8px;
      text-align: center;
    }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.u2.FUIDAutocompleter',
      name: 'autocompleter',
      factory: function() {
        return this.FUIDAutocompleter.create();
      }
    },
    {
      //overriding parent class factory
      class: 'String',
      name: 'title',
      value: ''
    },
    {
      //overriding parent class factory
      class: 'String',
      name: 'emptyTitle',
      value: ''
    },
    {
      name: 'onSelect',
      value: async function(obj, e) {
        var menus = []
        var menuDAOS = this.saltMap[obj.daoKey];
        for ( var i = 0; i < menuDAOS.length; i++ ) {
          var result = await menuDAOS[i].handler.config.dao.find(obj.data);
          if ( result )
            menus.push(menuDAOS[i]);
        }
        var selection = menus.map( c => {
          return this.Action.create({
            label: c.label + ' (' + c.id + ')',
            code: function() {
              this.menuPush(obj.data, c);
            }
          });
        });
        var overlay = this.OverlayDropdown.create({ parentEl: this });
        this.ctrl.add(overlay);
        var el = this.E().startContext({ data: this, dropdown: overlay }).forEach(selection, function(action, index) {
        this
        .start()
          .addClass(this.myClass('button-container'))
          .tag(action, { buttonStyle: 'UNSTYLED' })
          .attrs({ tabindex: -1 })
        .end();
        })
        .endContext();
        overlay.add(el);
        overlay.open(e.clientX, e.clientY);
      }
    },
    {
      class: 'Map',
      name: 'saltMap'
    }
  ],

  methods: [
    function populate(filteredValues, data, inputFocused) {
      var self = this;
      if ( ! data ) return this.E();
      if ( ! filteredValues.length ) return this.E().addClass(this.myClass('suggestions')).add(this.emptyTitle);
      var a = this.E().addClass(this.myClass('suggestions')).add(this.title)
      for ( var i = 0; i < self.filteredValues.length; i++) {
        let obj = self.filteredValues[i];
        a.start(this.rowView, { data: obj.data, of: obj.data.cls_.id })
          .addClass(self.myClass('row'))
          .on('mousedown', function(e) {
            self.onRowSelect ? self.onRowSelect(obj,e) : self.onSelect.call(self,obj, e);
          })
        .end()
      }
      return a;
    }
  ],


  listeners: [
    {
      name: 'onUpdate',
      isFramed: true,
      code: function() {
        this.filteredValues = this.autocompleter.filtered;
        var self = this;
        var menuDao = this.__subContext__['menuDAO'];
        if ( Object.keys(this.saltMap).length > 0 ) return;
        menuDao.select( async function(obj) {
           if ( ! obj?.handler?.config?.daoKey && ! self.__subContext__[obj?.handler?.config?.daoKey] ) return;
           try {
             var salt = await self.__subContext__[obj.handler.config.daoKey].cmd_(self, foam.dao.FUIDDAO.SALT_CMD);
           } catch {
             //NO OP
           }
           if (salt) {
              if ( ! self.saltMap[salt] )
                self.saltMap[salt] = [];
              if ( ! self.saltMap[salt].includes(obj) )
                self.saltMap[salt].push(obj);
           }
        });
      }
    },
    function loaded() {
      this.onDetach(this.autocompleter.filtered$.sub(this.onUpdate));
    },
    function menuPush(obj, menu) {
      if ( ! this.stack ) return;
      this.stack.push(this.StackBlock.create({
        view: {
          class: 'foam.comics.v2.DAOSummaryView',
          data: obj,
          config: menu.handler.config,
          idOfRecord: obj.id
        }, parent: this.__subContext__.createSubContext({ currentControllerMode: 'view' }) }, this));
    }
  ]
});
