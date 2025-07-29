/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'foam.core.reflow.control',
    name: 'ComponentsControl',
    extends: 'foam.u2.Element',

    requires: [ 'foam.core.reflow.DynamicReflowComponents', 'foam.u2.ToggleActionView' ],
    imports: [ 'eval_' ],

    css: `
      ^promptHolder {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px;
        position: relative;
        max-height: 30px;
      }
      ^expanded-island {
        position: absolute;
        bottom: 100%;
        margin-bottom: 10px;
        background-color: $backgroundDefault;
        border: 1px solid $borderLight;
        box-shadow: 0 0 10px 0 $borderLight;
        padding: 10px;
        min-width: 300px;
      }
    `,
  
    properties: [
      'data',
      {
        class: 'Boolean',
        name: 'opened',
        value: false
      },
      {
        name: 'buttonLabel',
        class: 'String',
        value: 'Components'
      },
      {
        name: 'buttonIcon',
        class: 'String',
        value: 'plus'
      },
      {
        class: 'foam.u2.ViewSpec',
        name: 'spec',
        factory: function() {
          return { class: 'foam.core.reflow.DynamicReflowComponents' }
        }
      }
    ],

    methods: [
      function init() {
        this.SUPER();
        window.addEventListener('mousedown', this.handleClickOutside);
      },

      function render() {
        var self = this;
        this.start().addClass(this.myClass('promptHolder'))
          .add(this.dynamic(function(opened) {
            if (opened) {
              this.start().addClass(self.myClass('expanded-island'), self.myClass('holder'))
                .start(self.spec, { data: self.data })
              .end();
            }
          }))
          .start()
            .startContext({ data: this })
              .tag(this.ToggleActionView, {
                action: this.COMPONENTS,
                label$: self.buttonLabel$,
                buttonStyle: 'SECONDARY',
                themeIcon$: self.buttonIcon$,
                actionState$: self.opened$
              })
            .endContext()
          .end()
        .end();
      }
    ],

    listeners: [
      function handleClickOutside(e) {
        const islandHolder = document?.querySelector(`.${this.myClass('expanded-island')}`);
        if (islandHolder && !islandHolder.contains(e.target)) {
          this.opened = false;
        }
      }
    ],

    actions: [
      {
        name: 'components',
        size: 'SMALL',
        code: function() {
            this.opened = !this.opened;
        }
      }
    ]
  });
  