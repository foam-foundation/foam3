/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'MenuBar',
  extends: 'foam.u2.Element',

  implements: [ 'foam.mlang.Expressions' ],

  requires: [ 'foam.core.menu.Menu' ],

  imports: [
    'currentMenu',
    'lastMenuLaunched',
    'menuDAO',
    'window'
  ],

  documentation: 'Navigational menu bar',

  css: `
    ^ {
      vertical-align: top;
    }
    ^ ul {
      margin-top: 20px;
      list-style-type: none;
    }
    ^ li {
      margin-left: 25px;
      display: inline-block;
      cursor: pointer;
    }
    ^ .foam-core-menu-SubMenuView-inner {
      z-index: $z-popup;
    }
  `,

  properties: [
    {
      name: 'menuName',
      value: '' // The root menu
    }
  ],

  methods: [
    function render() {
      var self = this;

      this
        .addClass(this.myClass())
        .start()
          .start('ul')
            .addClass('p')
            .select(this.menuDAO
                .where(this.EQ(this.Menu.ENABLED, true))
                .where(this.EQ(this.Menu.PARENT, this.menuName)), function(menu) {
              return this.E('li')
                .call(function() {
                  var e = this;
                  this.start()
                    .addClass('menuItem')
                    .enableClass('hovered', self.lastMenuLaunched$.map(function (value) { return value ? value.id === menu.id : false; }))
                    .enableClass('selected', self.currentMenu$.map(function (value) {
                      // only show selected menu if user settings sub menu item has not been selected
                      if ( self.window.location.hash.includes('#set') ) return false;
                      return self.isSelected(value, menu);
                    }))
                    .add(menu.label)
                    .on('click', function() {
                      menu.launch_(self.__context__, e);
                    }.bind(this))
                  .end();
                });
            })
          .end()
        .end()
      .end();
    },

    function isSelected(current, menu) {
      if ( ! current ) return false;

      if ( this.window.location.hash.includes('#' + menu.id) ) {
        return true;
      }

      if ( current.parent ) {
        if ( current.parent === menu.id ) {
          return true;
        }
      }

      return false;
    }
  ]
});
