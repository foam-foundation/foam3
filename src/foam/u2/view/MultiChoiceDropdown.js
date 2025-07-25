/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
    package: 'foam.u2.view',
    name: 'MultiChoiceDropdown',
    extends: 'foam.u2.View',
    // extends: 'foam.u2.view.MultiChoiceView',
  
    requires: [
      'foam.u2.view.MultiChoiceView'
    ],
  
    css: `
      ^ .foam-u2-view-MultiChoiceView-flexer > div {
        width: fit-content !important;
      }
      ^ .foam-u2-view-MultiChoiceView-flexer {
        display: flex;
        flex-wrap: wrap;
        width: 100%;
        gap: 0.5rem;
      }
      ^ .foam-u2-view-MultiChoiceView-flexer > * {
        flex: 1 0 16.666%; /* 6 columns: 100/6 */
        min-width: 0;
        box-sizing: border-box;
        text-align: center;
        padding: 4px 0;
      }
    
      ^container {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
      }
      ^toggle-container {
        display: flex;
        padding: 8px;
        border: 1px solid $borderLight;
        border-radius: 4px;
      }
      ^toggle-content {
        display: flex;
        flex-direction: row;
        align-items: left;
        justify-content: space-between;
        width: 100%;
      }
      ^selected-label {
        text-align: left;
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-right: 8px;
      }
      ^collapsible {
        background-color: $backgroundDefault;
        box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.1);
        padding: 8px;
        border: 1px solid $borderLight;
        border-radius: 4px;
        position: absolute;
        top: 100%;
        z-index: 1000;
        width: 100%;
        max-width: 100%;
      }
    `,
  
    properties: [
      {
        class: 'foam.u2.ViewSpec',
        name: 'choiceView',
        value: { class: 'foam.u2.view.DayChoiceView' }
      },
      {
        name: 'maxSelected',
        value: 12
      },
      {
        name: 'showMinMaxHelper',
        value: false
      },
      {
        name: 'numberColumns',
        value: 12
      },
      {
        class: 'Boolean',
        name: 'isOpen'
      },
      {
        class: 'Array',
        name: 'choices',
        value: []
      },
      {
        class: 'String',
        name: 'label'
      }
    ],
    methods: [
      function init() {
        this.SUPER();
        this.boundHandleClickOutside = this.handleClickOutside.bind(this);
        window.addEventListener('mousedown', this.boundHandleClickOutside);
      },

      function destroy() {
        window.removeEventListener('mousedown', this.boundHandleClickOutside);
      },

      function handleClickOutside(e) {
        const islandHolder = document?.querySelector(`.${this.myClass('collapsible')}`);      if (islandHolder && !islandHolder.contains(e.target)) {
            this.isOpen = false;
        }
      },
      function render() {
        var self = this;
        this.addClass()
        .start()
          .addClass(this.myClass('container'))
            .startContext({ data: this })
              .start(this.TOGGLE_OPEN).addClass(this.myClass('toggle-container'))
                .add(this.dynamic(function(data) {
                    console.log('data', data);
                  var label = data.length > 0 ? data.map(v => v.shortName ?? v.toString()).join(' - ') : self.label;
                  this.start().addClass(self.myClass('toggle-content'))
                    .start('span').addClass(self.myClass('selected-label')).attr('title', label).add(label).end()
                    .start(foam.u2.tag.Image, {
                      glyph: 'dropdown',
                      embedSVG: true
                    }).addClass(self.myClass('chevron')).end()
                  .end()
                }))
              .end()
            .endContext()
            .start()
              .add(this.dynamic(function(isOpen) {
                if (isOpen) {
                  this.start()
                    .addClass(self.myClass('collapsible'))
                    .tag(self.MultiChoiceView, {
                      choices: self.choices,
                      choiceView: self.choiceView,
                      maxSelected: self.maxSelected,
                      showMinMaxHelper: self.showMinMaxHelper,
                      numberColumns: self.numberColumns,
                      data$: self.data$
                    })
                  .end()
                }
              }))
            .end()
        .end()
      }
    ],
    actions: [
      {
        name: 'toggleOpen',
        label: '',
        code: function() {
          this.isOpen = !this.isOpen;
        }
      }
    ]
  });
  