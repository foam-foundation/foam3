/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'TreeViewRow',
  extends: 'foam.u2.Element',

  requires: [
    'foam.mlang.ExpressionsSingleton',
    'foam.u2.tag.Image'
  ],

  exports: [
    'showTreeRow',
    'data'
  ],

  imports: [
    'collapsed',
    'dblclick?',
    'draggable',
    'onObjDrop',
    'returnExpandedCSS?',
    'selection',
    'startExpanded',
    'translationService?',
    'rowConfig'
  ],

  css: `
    ^ {
      cursor: pointer;
      inset: none;
      white-space: nowrap;
    }

    ^label-container {
      display: flex;
      align-items: center;
    }

    ^heading {
      min-height: 40px;
      display: flex;
      align-items: center;
    }

    button^button {
      padding: 8px;
      width: 100%;
      justify-content: flex-start;
    }

    ^button svg { fill: currentColor; }
  `,

  classes: [
    {
      name: 'LabelView',
      extends: 'foam.u2.View',
      requires: [
        'foam.u2.tag.Image'
      ],

      css: `
        ^select-level {
          display: flex;
          justify-content: space-between;
          overflow: hidden;
          padding-right: 8px;
          text-align: left;
          width: 100%;
        }

        ^select-level > * {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        ^toggle-icon {
          align-self: center;
          transition: 0.2s linear;
        }

        ^toggle-icon svg {
          width: 0.75em;
          height: 0.75em;
        }

        /* copied from foam.core.controller.Fonts so that it works without CORE */
        .p-semiBold {
          line-height: 1.78;
          font-size: 1.4rem;
          font-style: normal;
          font-weight: 600;
          line-height: 1.71;
          margin: 0;
        }
      `,

      properties: [
        {
          name: 'row'
        }
      ],

      methods: [
        function render() {
          let row  = this.row;
          let self = this;
          var selectedSlot = row.slot(function(selected_) {
            return selected_ ? 'p-semiBold' : 'p';
          });
          this.addClass(this.myClass('select-level'))
            .enableClass(this.myClass('select-level-selected'), row.selected_$)
            .callIfElse(row.rowConfig?.[row.data.id],
              function() {
                this.tag(row.rowConfig?.[row.data.id])
              },
              function() {
                this.start()
                  .addClass(selectedSlot)
                  .addClass(this.myClass('label'))
                  .call(row.formatter, [row.data, self.__context__])
                .end();
              }
            )
            .add(row.hasChildren$.map(hasChildren => {
              if ( ! hasChildren ) return self.E();
              return self.E()
                .addClass(self.myClass('toggle-icon'))
                .style({
                  'transform': row.expanded$.map(function(c) { return c ? 'rotate(90deg)': 'rotate(0deg)'; })
                })
                .on('click', this.toggleExpanded)
                .tag(self.Image, { glyph: 'next' });
            }));
        }
      ]
    }
  ],

  properties: [
    {
      name: 'data'
    },
    {
      name: 'relationship'
    },
    {
      class: 'Boolean',
      name: 'expanded',
      postSet: function(o, n) {
        if ( n ) {
          delete this.collapsed[this.data.id];
        } else if ( this.hasChildren ) {
          this.collapsed[this.data.id] = true;
        }
      }
    },
    {
      class: 'Function',
      name: 'formatter'
    },
    {
      class: 'Boolean',
      name: 'hasChildren'
    },
    {
      class: 'Boolean',
      name: 'doesThisIncludeSearch',
      value: false
    },
    'query',
    {
      class: 'Boolean',
      name: 'showThisRootOnSearch'
    },
    {
      class: 'Array',
      name: 'subMenus'
    },
    'showRootOnSearch',
    {
      class: 'Boolean',
      name: 'updateThisRoot',
      value: false
    },
    {
      class: 'Function',
      name: 'onClickAddOn'
    },
    {
      class: 'Int',
      name: 'level'
    },
    {
      class: 'Boolean',
      name: 'selected_',
      expression: function(selection, data$id) {
        return selection && foam.util.equals(selection.id, this.data.id);
      }
    },
    {
      class: 'Boolean',
      name: 'showTreeRow',
      value: true
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      var controlledSearchSlot;

      if ( this.query ) {
        controlledSearchSlot = foam.lang.SimpleSlot.create();
        this.query.sub(function() {
          self.updateThisRoot = true;
          self.showThisRootOnSearch = false;
          controlledSearchSlot.set(self.query.get());
          self.updateThisRoot = false;
        });
      }

      if ( self.showRootOnSearch )
        self.showRootOnSearch.set(self.showRootOnSearch.get() || self.doesThisIncludeSearch);

      var cb = () => {
        this.data[self.relationship.forwardName].select().then(function( val ) {
          self.hasChildren = val.array.length > 0;
          self.subMenus    = val.array;
        });
      }
      
      this.onDetach(this.data[self.relationship.forwardName].listen({ put: cb }));
      cb();

      var labelString = this.data.label;
      if ( this.translationService ) {
        labelString = self.translationService.getTranslation(foam.locale, self.data.label, self.data.label);
      }

      // Check if handler has a custom row view
      if ( this.data && this.data.createRowView ) {
        this.start()
          .style({
            'padding-left': (((self.level - 0.5) * 16) + 'px')
          })
          .tag(this.data.createRowView(this.__context__, this.data))
        .end();
        return;
      }

      // Regular menu item rendering
      this.
        addClass(this.myClass()).
        show(this.slot(function( showTreeRow, hasChildren, showThisRootOnSearch, updateThisRoot ) {
          if ( ! showTreeRow ) return false;
          if ( ! self.query ) return true;
          var isThisItemRelatedToSearch = false;
          if ( ! updateThisRoot ) {
            self.doesThisIncludeSearch = self.query.get() ? self.data.label.toLowerCase().includes(self.query.get().toLowerCase()) : true;

            if ( self.query.get() && !self.doesThisIncludeSearch && self.data.keywords ) {
              for ( var i = 0 ; i < self.data.keywords.length ; i++ ) {
                if ( self.data.keywords[i].toLowerCase().includes(self.query.get().toLowerCase()) ) {
                  self.doesThisIncludeSearch = true;
                  break;
                }
              }
            }

            isThisItemRelatedToSearch = self.query.get() ? ( self.doesThisIncludeSearch && ( ! hasChildren || self.data.parent !== '' ) ) || ( hasChildren && showThisRootOnSearch ) : true;
            if ( self.showRootOnSearch )
              self.showRootOnSearch.set(self.showRootOnSearch.get() || isThisItemRelatedToSearch);
          } else {
            isThisItemRelatedToSearch = true;
          }
          if ( ! self.query.get() ) {
            self.expanded = false;
          } else if ( self.query.get() && isThisItemRelatedToSearch ) {
            self.expanded = true;
          }
          return isThisItemRelatedToSearch;
        })).
        enableClass(this.myClass('selected'), this.selected_$).
        on('dblclick', function() { self.dblclick && self.dblclick(self.data); }).
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
            'padding-left': (((self.level - 0.5) * 16 ) + 'px')
          }).
          startContext({ data: self }).
            start(self.ON_CLICK_FUNCTIONS, {
              buttonStyle: 'UNSTYLED',
              label: { class: 'foam.u2.view.TreeViewRow.LabelView', row: self },
              ariaLabel: labelString,
              size: 'SMALL',
              themeIcon: self.data.themeIcon || '',
              icon: self.data.icon || ''
            }).
              enableClass('selected', this.selected_$).
              addClass(this.myClass('button')).
            end().
          endContext().
        end().
        start().
          show(this.expanded$).
          add(this.slot(function( subMenus ) {
            return this.E().forEach(subMenus/*.dao*/, function( obj ) {
              this.add(self.cls_.create({
                data:             obj,
                formatter:        self.formatter,
                relationship:     self.relationship,
                expanded:         ! self.collapsed[obj.id],
                showRootOnSearch: self.showThisRootOnSearch$,
                query:            controlledSearchSlot,
                onClickAddOn:     self.onClickAddOn,
                level:            self.level + 1
              }, self)).addClass('child-menu');
            });
          })).
        end();
    }
  ],

  listeners: [
    function onDragStart(e) {
      e.dataTransfer.setData('application/x-foam-obj-id', this.data.id);
      e.stopPropagation();
    },

    function onDragOver(e) {
      if ( ! e.dataTransfer.types.some(function( m ) { return m === 'application/x-foam-obj-id'; }) )
        return;

      var id = e.dataTransfer.getData('application/x-foam-obj-id');

      if ( foam.util.equals(id, this.data.id) )
        return;

      e.preventDefault();
      e.stopPropagation();
    },

    function onDrop(e) {
      if ( ! e.dataTransfer.types.some(function( m ) { return m === 'application/x-foam-obj-id'; }) )
        return;

      var id = e.dataTransfer.getData('application/x-foam-obj-id');

      if ( foam.util.equals(id, this.data.id) ) return;

      e.preventDefault();
      e.stopPropagation();

      var self = this;
      var dao  = this.__context__[this.relationship.targetDAOKey];
      dao.find(id).then(function( obj ) {
        if ( ! obj ) return null;

        // TODO: We shouldn't have to remove then put,
        // We currently have to because the FLOW editor is not updating properly
        // on a put event for an object that it already has.
        dao.remove(obj).then(function() {
          self.data[self.relationship.forwardName].put(obj).then(function( obj ) {
            self.onObjDrop(obj, id);
          });
        });
      });
    },

    function selected(e) {
      this.selection = this.data;
      e.preventDefault();
      e.stopPropagation();
    }
  ],

  actions: [
    {
      name: 'onClickFunctions',
      label: '',
      code: function () {
        if ( this.onClickAddOn )
          this.onClickAddOn(this.data, this.hasChildren);
        this.toggleExpanded();
      }
    },
    {
      name: 'toggleExpanded',
      label: '',
      code: function() {
        this.expanded  = ! this.expanded;
        this.selection = this.data;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'TreeView',
  extends: 'foam.u2.Element',

  requires: [
    'foam.mlang.ExpressionsSingleton',
    'foam.u2.view.TreeViewRow'
  ],

  imports: [
    'theme'
  ],

  exports: [
    'collapsed',
    'draggable',
    'onObjDrop',
    'rowConfig',
    'selection',
    'startExpanded'
  ],

  css: `
    ^ {
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0 8px;
    }
  `,

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      name: 'relationship'
    },
    {
      name: 'selection'
    },
    {
      class: 'Function',
      name: 'formatter'
    },
    {
      class: 'Boolean',
      name: 'startExpanded',
      value: false
    },
    'query',
    {
      class: 'Function',
      name: 'onClickAddOn'
    },
    {
      name: 'rowConfig',
      documentation: `
      Allows overrides for menu Row views where required
      Format: { menuId: viewSpec }
      ex: { notifications: {class: 'NotificationMenuItem' } }
      `
    },
    {
      class: 'Boolean',
      name: 'draggable',
      documentation: 'Enable to allow drag&drop editing.'
    },
    [ 'defaultRoot', '' ],
    {
      // Set of collapsed TreeRows
      name: 'collapsed',
      factory: function() { return {}; }
    }
  ],

  methods: [
    function render() {
      this.startExpanded = this.startExpanded;

      var of  = this.__context__.lookup(this.relationship.sourceModel);
      var dao = this.data$proxy.where(
        this.EQ(of.getAxiomByName(this.relationship.inverseName), this.defaultRoot));
      var self = this;
      var isFirstSet = false;

      this.addClass().
        select(dao, function( obj ) {
          if ( ! isFirstSet && ! self.selection ) {
            self.selection = obj;
            isFirstSet = true;
          }
          var t = {
            class:        foam.u2.view.TreeViewRow,
            data:         obj,
            relationship: self.relationship,
            expanded:     self.startExpanded,
            formatter:    self.formatter,
            query:        self.query,
            onClickAddOn: self.onClickAddOn,
            level:        1
          };
          if ( this.U3 ) {
            this.tag({
              class:        foam.u2.view.TreeViewRow,
              data:         obj,
              relationship: self.relationship,
              expanded:     self.startExpanded,
              formatter:    self.formatter,
              query:        self.query,
              onClickAddOn: self.onClickAddOn,
              level:        1
            });
          } else {
            return this.E().tag(t);
          }
        });
    },

    function onObjDrop(obj, target) {
      // Template Method
    }
  ]
});
