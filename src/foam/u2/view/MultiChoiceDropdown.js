/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
    package: 'foam.u2.view',
    name: 'MultiChoiceDropdown',
    extends: 'foam.u2.Controller',
    // extends: 'foam.u2.view.MultiChoiceView',
  
    requires: [
      'foam.u2.view.MultiChoiceView',
      'foam.u2.md.OverlayDropdown'
    ],
  
    css: `
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
        value: 4
      },
      {
        class: 'Array',
        name: 'choices',
        value: []
      },
      {
        class: 'String',
        name: 'label'
      },
      {
        class: 'FObjectProperty',
        of: 'foam.u2.Element',
        name: 'dropdown_',
        factory: function() {
          return this.OverlayDropdown.create({
            closeOnLeave: true,
            lockToParentWidth: true,
          });
        }
      },
      {
        class: 'Boolean',
        name: 'isOpen_',
        documentation: `
          An internal property used to determine whether the options list is
          visible or not.
        `
      },
      'data'
    ],
    methods: [

      function render() {
        var self = this;
        
        this.isOpen_$.follow(this.dropdown_.opened$);
        this.dropdown_.add(this.dynamic(function() {
          this.start()
            .tag(self.MultiChoiceView, {
              choices: self.choices,
              choiceView: self.choiceView,
              maxSelected: self.maxSelected,
              showMinMaxHelper: self.showMinMaxHelper,
              numberColumns: self.numberColumns,
              data$: self.data$
            })
          .end()
        }))

        this.addClass()
        .start()
          .addClass(this.myClass('container'))
            .start(this.TOGGLE_OPEN).addClass(this.myClass('toggle-container'))
              .add(this.dynamic(function(data) {
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
            .add(this.dropdown_)
          
        .end()
      }
    ],
    actions: [
      {
        name: 'toggleOpen',
        label: '',
        code: function(_, e) {
          if (this.isOpen_) {
            this.dropdown_.close();
          } else {

            this.dropdown_.parentEl = this.el_();
            this.dropdown_.open();
          }
        }
      }
    ]
  });
  