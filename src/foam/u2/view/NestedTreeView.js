/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/


foam.CLASS({
  package: 'foam.u2.view',
  name: 'TreeViewHeading',
  extends: 'foam.u2.view.TreeViewRow',

  classes: [
    {
      name: 'LabelView',
      extends: 'foam.u2.view.TreeViewRow.LabelView',
      css: `

        ^select-level {
          justify-content: flex-start;
          gap: 8px;
        }
      `,

      methods: [
        function render() {
          let row = this.row;
          let self = this;
          this.
             addClass(self.myClass('select-level'))
            .start(self.Image, { glyph: 'next' })
            .addClass(self.myClass('toggle-icon'))
            .style({ 'transform': 'rotate(180deg)' })
            .end()
            .callIfElse(row.rowConfig?.[row.data.id],
              function() {
                this.tag(row.rowConfig[row.data.id]);
              },
              function() {
                this.start()
                  .addClass('p-semiBold')
                  .addClass(self.myClass('label'))
                  .call(row.formatter, [row.data])
                .end();
              }
            );
        }
      ]
    }
  ],

  methods: [
    function render() {
      var self        = this;
      var labelString = this.data.label;

      if ( this.translationService ) {
        labelString = self.translationService.getTranslation(foam.locale, self.data.label, self.data.label);
      }

      // Check if handler has a custom row view
      if ( this.data.createRowView ) {
        this.start()
          .style({
            'padding-left': (((self.level - 1) * 16) + 'px')
          })
          .tag(this.data.createRowView(this.__context__, this.data))
        .end();
        return;
      }

      // Regular menu item rendering
      this.
        addClass(this.myClass()).
        enableClass(this.myClass('selected'), this.selected_$).
        callIf(this.draggable, function() {
          this.
          attrs({ draggable: 'true' }).
          on('dragstart', this.onDragStart).
          on('dragenter', this.onDragOver).
          on('dragover',  this.onDragOver).
          on('drop',      this.onDrop);
        }).
        start().
          addClass(self.myClass('heading')).
          style({
            'padding-left': ((( self.level - 1) * 16 ) + 'px')
          }).
          startContext({ data: self }).
            start(self.ON_CLICK_FUNCTIONS, {
              buttonStyle: 'UNSTYLED',
              label: { class: 'foam.u2.view.TreeViewHeading.LabelView', row: self },
              ariaLabel: labelString,
              size: 'SMALL'
            }).
              attrs({ title: labelString }).
              enableClass('selected', this.selected_$).
              addClass(this.myClass('button')).
            end().
          endContext().
        end();
    }
  ]
});



foam.CLASS({
  package: 'foam.u2.view',
  name: 'NestedTreeView',
  extends: 'foam.u2.view.TreeView',

  requires: [
    'foam.mlang.ExpressionsSingleton',
    'foam.u2.view.TreeViewRow',
    'foam.u2.view.TreeViewHeading'
  ],

  properties: [
    { name: 'currentRootStack', class: 'Array'  },
    'currentRoot',
    {
      class: 'Boolean',
      name: 'continueNesting',
      documentation: 'When set to true, all parent/child relationships are opened as nested trees instead of inline trees'
    }
  ],

  methods: [
    function render() {
      this.startExpanded = this.startExpanded;

      var of  = this.__context__.lookup(this.relationship.sourceModel);
      var self = this;
      var isFirstSet = false;

      this.addClass().
        add(this.slot(function(currentRoot) {
          var dao = this.data$proxy.where(
            this.EQ(of.getAxiomByName(this.relationship.inverseName), currentRoot || this.defaultRoot));
          return this.E()
          .callIf(currentRoot, function() {
            this
              .startContext({ data: self })
                .tag(self.TreeViewHeading, {
                  data:         currentRoot,
                  relationship: self.relationship,
                  expanded:     self.startExpanded,
                  formatter:    self.formatter,
                  query:        self.query,
                  onClickAddOn: self.back,
                  level:        1
                })
              .end()
          })
          .select(dao, function(obj) {
            if ( ! isFirstSet && ! self.selection ) {
              self.selection = obj;
              isFirstSet = true;
            }
            let t = {
              class:        foam.u2.view.TreeViewRow,
              data:         obj,
              relationship: self.relationship,
              expanded:     self.startExpanded,
              formatter:    self.formatter,
              query:        self.query,
              // Unless specified, stop nesting after one level
              onClickAddOn: this.continueNesting || ! currentRoot ? self.onClickAddOn1 : self.onClickAddOn,
              level:        1
            }
            this.tag(t);
          });
        }));
    }
  ],
  listeners: [
    function onClickAddOn1(obj, hasChildren) {
      this.onClickAddOn(obj, hasChildren);
      if ( hasChildren ) {
        this.currentRootStack$push(obj);
        this.currentRoot = this.currentRootStack?.[this.currentRootStack.length-1]
      }
    },
    function back() {
      this.currentRootStack.pop();
      this.currentRoot = this.currentRootStack?.[this.currentRootStack.length-1]
    }
  ]
});
