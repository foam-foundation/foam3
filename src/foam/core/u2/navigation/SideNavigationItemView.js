/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.u2.navigation',
  name: 'SideNavigationItemView',
  extends: 'foam.u2.View',

  imports: [
    'currentMenu'
  ],

  requires: [
    'foam.core.menu.Menu',
  ],

  css:`
    ^selected {
      opacity:1 !important;
      text-shadow: 0 0 0px white, 0 0 0px white;
    }
    ^disabled a {
      opacity: 0.35 !important;
      cursor: default !important;
      pointer-events: none;
    }
    ^disabled a:hover {
      opacity: 0.35 !important;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'expanded',
      value: false
    },
    {
      class: 'Int',
      name: 'level'
    }
  ],

  methods: [
    function render() {
      var view = this;

      var paddingLeft = view.level * 10 + 15;
      var fontSize = view.level * -1 + 18;
      var opacity = view.level * -0.1 + 0.9;

      this
        .addClass(`${this.myClass()}-level-${this.level}`)
        .enableClass(this.myClass('disabled'), ! this.data.enabled)
        .start('a')
          .add(this.data.label)
          .enableClass(this.myClass('selected'), view.currentMenu$.map(function (value) {
            return view.currentMenu.id === (view.data.id);
          }))
          .style({'padding-left': paddingLeft +  'px', 'font-size': fontSize + 'px', 'opacity': opacity})
          .on('click', this.onClick)
        .end()
        .add(this.slot(function(expanded, data) {
          return ! expanded ?
            this.E() :
            this.E()
              .select(data.children.orderBy(view.Menu.ORDER), function(child) {
                return view.cls_.create({ data: child, level: view.level + 1 }, view);
              });
            }))
          .end();
      },

      function handleClick(menu) {
        var self = this;

        if ( menu.handler != 'foam.core.menu.SubMenu' ) {
          if ( this.currentMenu.id !== menu.id ) {
            menu.launch(this.__context__, this);
          }
        }

        this.expanded = ! this.expanded;
      }
    ],

    listeners: [
      function onClick() {
        this.handleClick(this.data);
      }
    ]
  });
