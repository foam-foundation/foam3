/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

/**
 * TODO:
 * - NOT A REAL VIEW BECAUSE IT DOESN"T BIND PROPERLY TO 'DATA'. Only used by CrunchLab.
 *   Fix before trying to use elsewhere.
 * - Add using RichChoiceView does not work, why??
 * - Improve UX when adding objects to larger 1:* relationships/larger screens using a full table view
 * - How to handle broken relationships (destroy, rebound/reassign, orphan)
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'DAOListWithCreateView',
  extends: 'foam.u2.view.FObjectArrayView',
  documentation: `DAOList with inline add and remove support. Mainly for use in wizards and
  smaller screens where showing a full DAOController may not be possible/desirable`,

  requires: [
    'foam.u2.view.CollapseableDetailView',
    'foam.u2.view.DraftDetailView',
    'foam.u2.stack.StackBlock',
    'foam.comics.v2.DAOControllerConfig',
    'foam.comics.v2.DAOBrowseControllerView'
  ],

  implements: [ 'foam.mlang.Expressions' ],

  imports: [
    'stack'
  ],

  exports: [
    'dao',
    'onCancel',
    'onSave',
    'updateData'
  ],

  css: `
    ^createWrapper {
      padding: 8px 16px;
      background: $backgroundSecondary;
      display: flex;
      gap: 8px;
      flex-direction: column;
    }
    ^actionBar {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    ^actionBar > .foam-u2-ActionView + .foam-u2-ActionView {
      margin-left: 0px;
    }
  `,

  classes: [
    {
      name: 'Row',
      imports: [
        'data',
        'dao',
        'enableRemoving',
        'mode',
        'updateData'
      ],
      properties: [
        {
          class: 'Int',
          name: 'index',
          visibility: 'RO'
        },
        {
          name: 'value',
          postSet: function(_, n) {
            if ( this.data[this.index] === n ) return;
            this.dao.remove(n);
          }
        }
      ],
      methods: [
        function toSummary() {
          return this.value.toSummary();
        }
      ],
      actions: [
        {
          name: 'remove',
          confirmationView: function () { return true; },
          isAvailable: function(enableRemoving, mode) {
            return enableRemoving && mode === foam.u2.DisplayMode.RW;
          },
          code: function() {
            if ( this.dao.targetProperty ) {
              // Relationship
              var targetDAO = this.__subContext__[this.dao.targetDAOKey];
              if ( ! targetDAO ) {
                console.error('DAOListWithCreateView: targetDAOKey "' +
                  this.dao.targetDAOKey + '" is not in the context; cannot ' +
                  'remove the relationship entry.');
                return;
              }
              this.value[this.dao.targetProperty.name] = null;
              targetDAO.put(this.value);
            } else {
              // DAO
              this.dao.remove(this.value);
              this.updateData();
            }
          }
        }
      ]
    }
  ],

  properties: [
    [ 'showCreate', false ],
    {
      class:'foam.dao.DAOProperty',
      name: 'dao'
    },
    {
      name: 'valueView',
      value: { class: 'foam.u2.CitationView' }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'addView',
      factory: function() {
        return {
          class: 'foam.u2.detail.VerticalDetailView',
          hideActions: true,
          showTitle: false,
          of: this.of
        };
      },
      documentation: `
        ViewSpec used to create the add Object view.
        Defaults to adding a new object but can be speced to support
        adding exisitng objects from any dao using something like
        RichChoiceView(temoprarily broken). Eg:
        addView: {
            class: 'foam.u2.view.RichChoiceView',
            search: true,
            sections: [
              {
                heading: 'Data',
                dao: <DAO with options>
              }
            ]
          }
      `
    },
    'workingData',
    {
      name: 'propertyWhitelist',
      documentation: 'Passed to the createView, used by detailViews to only show some props of an FObject'
    },
    'DAOCount',
    {
      class: 'Boolean',
      name: 'showViewMore'
    }
  ],

  methods: [
    function init() {
      this.data = undefined;
      this.SUPER();
      this.dao$.sub(this.updateData);
      this.dao$.sub(this.updateCount);
      this.updateCount();
      this.updateData();
    },

    function fromProperty(p) {
      this.SUPER(p);
      if ( ! this.dao && p.data ) this.dao = p.data;
      if ( this.dao.of ) this.of = this.dao.of;
    },

    function addAction(showCreate, addView) {
      if ( showCreate )
        return this.E()
          .addClass(this.myClass('createWrapper'))
          .start(this.DraftDetailView, {
            view: {
              ...addView,
              propertyWhitelist$: this.propertyWhitelist$
            },
            data$: this.workingData$,
          })
            .addClass(this.myClass('createView'))
          .end();
      return this.SUPER().addClass(this.myClass('actionBar'));

      if ( this.showViewMore ) {
        this.start(this.VIEW_MORE, { buttonStyle: 'TERTIARY' })
          .addClass(this.myClass('addButton'))
        .end();
      }
    }
  ],

  listeners: [
    function updateCount() {
      this.dao.select(this.Count.create()).then(s => this.DAOCount = s.value);
    },
    function updateData() {
      if ( ! this.dao ) return;
      var self = this;
      this.dao.limit(10).select().then(r => {
        self.data = r.array;
        self.updateCount();
      });
    },
    function onSave(obj) {
      this.dao.put(obj).then( o => {
        console.log('put', o);
        this.showCreate = false;
        this.updateData();
      });
    },
    function onCancel() {
      this.showCreate = false;
    }
  ],

  actions: [
    {
      name: 'addRow',
      isAvailable: function(enableAdding, mode, of) {
        return enableAdding && mode === foam.u2.DisplayMode.RW;
      },
      code: function() {
        var newItem = this.defaultNewItem;
        if ( this.FObject.isInstance(newItem) ) {
          this.workingData = newItem.clone();
        }
        if ( this.dao.targetProperty )
          // If used with a relationship, automatically link a new object
          this.workingData[this.dao.targetProperty.name] = this.dao.sourceId;
        this.showCreate = true;
      }
    },
    {
      name: 'viewMore',
      isAvailable: function (DAOCount) {
        return DAOCount >= 10;
      },
      code: function() {
        this.stack.push(this.StackBlock.create({
          view: {
            class: this.DAOBrowseControllerView,
            data$: this.dao$,
            config: this.DAOControllerConfig.create({ dao: this.dao }),
          }, parent: this.__subContext__.createSubContext({ controllerMode: 'CREATE' }) }));
      }
    }
  ]
});
