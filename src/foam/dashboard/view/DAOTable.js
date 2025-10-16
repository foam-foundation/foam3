/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dashboard.view',
  name: 'DAOTable',
  extends: 'foam.u2.Element',

  requires: [
    'foam.dashboard.view.DashboardCitationView',
    'foam.comics.v2.DAOBrowseControllerView',
    'foam.u2.stack.StackBlock'
  ],

  imports: [
    'dashboardController',
    'menu',
    'routeTo',
    'stack'
  ],

  css: `
    ^ {
      position: relative;
      height: 100%;
    }
    ^center {
      height: 100%;
      min-height: 20rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }
    ^ .table-row:hover {
      background: $backgroundSecondary;
      cursor: pointer;
    }
    ^ .table-row {
      padding-left: 20px;
      padding-right: 20px;
      border-bottom: 1px solid $borderLight;

    }
    ^ div.table-row:last-child > div {
      border-bottom: none;
    }
    ^ .view-more button {
      width: 100%;
      height: 100%;
      max-height: max-content;
    }
    ^ .view-more button:hover {
      background: $backgroundSecondary;
      cursor: pointer;
      border-bottom-left-radius: 22px;
      border-bottom-right-radius: 22px;
    }
    ^scroll-container {
      overflow-y: scroll;
      display: grid;
      grid-auto-rows: 20%;
      height: 100%;
    }
    ^grid-container {
      display: grid;
      height: 100%;
    }
  `,

  properties: [
    {
      name: 'citationView',
      class: 'foam.u2.ViewSpec',
      factory: function() {
        return this.DashboardCitationView;
      }
    },
    {
      class: 'Boolean',
      name: 'viewMore',
      documentation: `
        If true, displays a button at the butttom of the table that redirects to a
        full TableView of the given dao. If false, the Table will default to scroll.
      `,
      postSet: function() {
        if ( this.viewMore ) this.limit = 5;
      }
    },
    {
      class: 'Array',
      name: 'currentValues',
      documentation: `
        A list of objects currently displayed in the Table. This list is used as a reference to prevent
        the it from re-rendering the table with the same data.
      `,
      value: []
    },
    {
      class: 'String',
      name: 'emptyTitle'
    },
    {
      class: 'String',
      name: 'emptySubTitle'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'dao'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'predicate',
      factory: function() {
        return foam.mlang.predicate.True.create();
      }
    },
    {
      class: 'Reference',
      of: 'foam.core.menu.Menu',
      name: 'viewMoreMenuItem',
      documentation: `
      If set, this will cause viewMoreAction() to instead open the given
      menu item. Default is empty.
      `
    },
    {
      class: 'Int',
      name: 'limit',
      value: 5
    },
    'mode'
  ],

  methods: [
    function init() {
      if ( this.dashboardController ) {
        this.onDetach(this.dashboardController.sub('dashboard', 'update', this.fetchValues));
      }
    },
    function render() {
      var self = this;
      this.fetchValues();
      this
        .addClass(this.myClass())
        .add(this.slot(function(currentValues) {
          var e = self.E();
          self.callIfElse(self.viewMore, function() {
            if ( currentValues.length != 0 ) {
              e.addClass(self.myClass('grid-container'));
            }
          }, function() {
            e.addClass(self.myClass('scroll-container'));
          });
          return e
            .callIf(currentValues.length == 0, function() {
              e.addClass(self.myClass('center'))
                .start().addClass('p-semiBold').translate(self.emptyTitle, self.emptyTitle,).end()
                .start().addClass('p').translate(self.emptySubTitle, self.emptySubTitle).end();
            })
            .forEach(currentValues, function(obj) {
              e.start().addClass('table-row')
                .start(self.citationView, {
                  data: obj,
                  sourceMenu$: self.viewMoreMenuItem$
                })
               .end();
           })
           .callIf(self.viewMore && currentValues.length >= self.limit, function() {
              e.start()
              .addClass('view-more')
              .startContext({data: self})
                .tag(self.VIEW_MORE_ACTION, {
                  buttonStyle: foam.u2.ButtonStyle.UNSTYLED
                })
              .endContext()
            .end();
           })
        }));
    }
  ],

  actions: [
    {
      name: 'viewMoreAction',
      label: 'View more activities',
      code: function() {
        this.routeTo(this.viewMoreMenuItem);
      }
    }
  ],

  listeners: [
    {
      name: 'fetchValues',
      code: function() {
        var self = this;
        if ( ! this.dao ) return;
        this.dao.where(this.predicate).limit(this.limit).select().then((objects) => {
          var fetchedValues = objects.array;
          if ( ! foam.util.equals(self.currentValues, fetchedValues) ) {
            self.currentValues = fetchedValues;
          }
        });
      }
    }
  ]
});
