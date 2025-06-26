/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ReflowToolBar',
  extends: 'foam.u2.View',

  requires: [
    'foam.core.reflow.DynamicReflowData',
    'foam.core.reflow.DynamicReflowComponents',
    'foam.core.reflow.DynamicReflowHelp',
    'foam.u2.ToggleActionView'
  ],

  css: `
    ^ {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: 50px;
      z-index: 20;
    }
    ^island-holder {
      display: flex;
      flex-direction: column;
      align-items: left;
      gap: 10px;
      align-items: center;
      max-width: 320px;
    }
      
    ^holder {
      padding: 10px;
      background-color: $white;
      border-radius: 4px;
      border: 1px solid $grey200;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      width: 100%;
    }

    ^button-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }
  `,

  properties: [
    {
      name: 'selected',
      value: null
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.boundHandleClickOutside = this.handleClickOutside.bind(this);
      window.addEventListener('mousedown', this.boundHandleClickOutside);
    },

    function destroy() {
      window.addEventListener('mousedown', this.boundHandleClickOutside);
    },

    function handleClickOutside(e) {
      const islandHolder = document?.querySelector(`.${this.myClass('island-holder')}`);      if (islandHolder && !islandHolder.contains(e.target)) {
        this.selected = null;
      }
    },

    function render() {
      var self = this;
      const actions = this.cls_.getAxiomsByClass(foam.lang.Action);
      this.addClass()
      .start().addClass(this.myClass('island-holder'))
        .add(this.dynamic(function(selected) {
          if (selected == 'collections') {
            this.start().addClass(self.myClass('expanded-island'), self.myClass('holder'))
              .start(self.DynamicReflowData, { data: self.data })
            .end();
          }
          if (selected == 'components') {
            this.start().addClass(self.myClass('expanded-island'), self.myClass('holder'))
              .start(self.DynamicReflowComponents, { data: self.data })
            .end();
          }
          if ( selected == 'help' ) {
            this.start().addClass(self.myClass('expanded-island'), self.myClass('holder'))
              .start(self.DynamicReflowHelp, { data: self.data })
            .end();
          }

        }))
        .start().addClass(this.myClass('holder'))
          .start().addClass(self.myClass('button-group'))
            .startContext({ data: self })
              .forEach(actions, function(action) {
                this.tag(self.ToggleActionView, {
                  action: action,
                  data: self,
                  actionState$: self.selected$.map(function(selected) {
                    return selected === action.name;
                  })
                }).end();
              })
            .endContext()
          .end()
        .end()
      .end();
    }
  ],

  actions: [
    {
      name: 'collections',
      label: 'Data',
      buttonStyle: foam.u2.ButtonStyle.TERTIARY,
      size: 'SMALL',
      themeIcon: 'file',
      code: function() {
        if ( this.selected === 'collections' ) {
          this.selected = null;
        } else {
          this.selected = 'collections';
        }
      }
    },
    {
      name: 'components',
      label: 'Components',
      buttonStyle: foam.u2.ButtonStyle.TERTIARY,
      size: 'SMALL',
      themeIcon: 'plus',
      code: function() {
        if ( this.selected === 'components' ) {
          this.selected = null;
        } else {
          this.selected = 'components';
        }
      }
    },
    {
      name: 'help',
      label: 'Help',
      buttonStyle: foam.u2.ButtonStyle.TERTIARY,
      themeIcon: 'helpIcon',
      size: 'SMALL',
      code: function() {
        if ( this.selected === 'help' ) {
          this.selected = null;
        } else {
          this.selected = 'help';
        }
      }
    }
  ]
});
