/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'GroupingDAOList',
  extends: 'foam.u2.Element',

  implements: [ 'foam.mlang.Expressions' ],

  documentation: 'A DAOList which groups citation views by the supplied groupExpr',

  topics: [ 'rowClick' ],

  exports: [
    'selection',
    'hoverSelection',
    'data as dao',
    'as summaryView'
  ],

  imports: [
    'editRecord?',
    'selection? as importSelection'
  ],

  messages: [
    { name: 'NO', message: 'No' }
  ],

  css: `
    << {
      padding: 32px 24px;
    }
    <<group-title {
      color: $textDefault;
      margin-bottom: 24px;
    }
    <<row + <<row{
      margin-top: 16px;
    }
    <<row + <<group-title {
      margin-top: 24px;
    }
  `,

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'rowView'
    },
    {
      class: 'FObjectProperty',
      name: 'groupExpr',
      documentation: 'An expression which returns the group title. Can be a Property.'
    },
    {
      class: 'FObjectProperty',
      name: 'order',
      documentation: 'Optional order used to sort citations within a group'
    },
    {
      class: 'Boolean',
      name: 'showEmptyMessage',
      documentation: 'Causes a "no <of.plural>" message to be shown when list is empty'
    },
    'selection',
    'hoverSelection'
  ],

  methods: [
    function render() {
      this.addClass();

      this.update();
      this.data$proxy.on.sub(this.update)
    }
  ],

  listeners: [
    {
      name: 'update',
      isMerged: true,
      mergeDelay: 100,
      code: function() {
        var curGroup;
        var dao = this.order ? this.data.orderBy(this.order) : this.data;
        var hasChildren = false;

        this.removeAllChildren();

        dao.select(obj => {
          hasChildren = true;
          var group = this.groupExpr.f(obj);
          if ( group !== curGroup ) {
            this.start().
              addClass('h300', this.myClass('group-title')).
              translate(group).
            end();
          }
          curGroup = group;

          this.start(this.rowView, { data: obj })
            .addClass(this.myClass('row'))
          .end();
        }).then(() => {
          if ( this.showEmptyMessage && ! hasChildren ) {
            this.add(this.NO, ' ', this.data.of.model_.plural);
          }
        });
      }
    }
  ]
});
