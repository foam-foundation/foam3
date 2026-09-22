/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'GridGroupingDAOList',
  extends: 'foam.u2.GroupingDAOList',
  documentation: 'GroupingDAOList which displays elements in a grid rather than in rows',

  css: `
    ^ {
      padding: 16px 12px;
    }
    ^group-title {
      color: $textDefault;
      padding-bottom: 16px;
      margin-bottom: 24px;
      border-bottom: 2px solid $borderDefault;
    }
    ^grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, 330px);
      justify-content: start;
      align-items: start;
      gap: 16px;
    }
    ^grid + ^group-title {
      margin-top: 24px;
    }
  `,

  listeners: [
    {
      name: 'update',
      isMerged: true,
      mergeDelay: 100,
      code: function() {
        var curGroup;
        var grid;
        var dao = this.order ? this.data.orderBy(this.order) : this.data;
        var hasChildren = false;

        this.removeAllChildren();

        dao.select(obj => {
          hasChildren = true;
          var group = this.groupExpr.f(obj);
          if ( group !== curGroup || ! grid ) {
            this.start().
              addClass('h300', this.myClass('group-title')).
              translate(group).
            end();
            grid = this.E().addClass(this.myClass('grid'));
            this.add(grid);
          }
          curGroup = group;

          grid.start(this.rowView, { data: obj })
            .addClass(this.myClass('cell'))
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