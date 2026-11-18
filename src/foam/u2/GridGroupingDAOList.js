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
    << {
      padding: 16px 12px;
    }
    <<group-title {
      color: $textDefault;
      padding-bottom: 16px;
      margin-bottom: 24px;
      border-bottom: 2px solid $borderDefault;
      /* A group nav click scrolls here; keep the title clear of the sticky nav */
      scroll-margin-top: 7rem;
    }
    <<grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, 330px);
      justify-content: start;
      align-items: start;
      gap: 16px;
    }
    <<grid + <<group-title {
      margin-top: 24px;
    }
    /* The list scrolls itself, so the sticky nav stops below the list's top
       padding and cards would show through that gap; the nav pads instead. */
    <<:has(> <<group-nav) {
      padding-top: 0;
    }
    <<group-nav {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
      padding: 1.6rem 0;
      background: $backgroundDefault;
    }
    <<group-nav:empty {
      display: none;
    }
    <<group-nav-item {
      display: inline-flex;
      align-items: center;
      gap: 0.8rem;
      min-height: 3.6rem;
      padding: 0 1.4rem;
      border: 1px solid $borderLight;
      border-radius: 1.8rem;
      background: $backgroundDefault;
      color: $textDefault;
      cursor: pointer;
    }
    <<group-nav-item:hover {
      background: $backgroundHover;
    }
    <<group-nav-count {
      color: $textSecondary;
    }
  `,

  messages: [
    { name: 'GROUP_NAV_LABEL', message: 'Jump to a group' }
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'showGroupNav',
      documentation: `
        Shows a row of buttons above the groups, one per group with the number
        of rows in it, that stays at the top while the list scrolls. A click
        scrolls to that group, so the last of ten groups, three screens down,
        is one click away.
      `
    }
  ],

  methods: [
    function renderGroupNav(nav, groups) {
      /** Fills the group nav: one button per group, a click scrolls to the group's title. */
      var self = this;
      nav.forEach(groups, function(g) {
        var button = this.start('button')
          .attrs({ type: 'button' })
          .addClass(self.myClass('group-nav-item'), 'p-semiBold')
          .on('click', () => g.title.el_().scrollIntoView({ behavior: 'smooth', block: 'start' }));
        self.renderGroupNavItem(button, g);
        button.end();
      });
    },

    function renderGroupNavItem(button, g) {
      /**
       * Fills one group button: the group name and its row count. A subclass
       * overrides it to add to the button, such as a colour per group.
       */
      button
        .translate(g.group)
        .start('span').addClass(this.myClass('group-nav-count')).add(g.count).end();
    }
  ],

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
        var groups = [];
        var nav;

        this.removeAllChildren();

        // Filled once the select ends, when every group's count is known
        if ( this.showGroupNav ) {
          nav = this.E().addClass(this.myClass('group-nav')).attrs({ 'aria-label': this.GROUP_NAV_LABEL });
          this.add(nav);
        }

        dao.select(obj => {
          hasChildren = true;
          var group = this.groupExpr.f(obj);
          if ( group !== curGroup || ! grid ) {
            var title = this.E().
              addClass('h300', this.myClass('group-title')).
              translate(group);
            this.add(title);
            groups.push({ group: group, title: title, count: 0 });
            grid = this.E().addClass(this.myClass('grid'));
            this.add(grid);
          }
          curGroup = group;
          groups[groups.length - 1].count++;

          grid.start(this.rowView, { data: obj })
            .addClass(this.myClass('cell'))
          .end();
        }).then(() => {
          if ( nav ) this.renderGroupNav(nav, groups);
          if ( this.showEmptyMessage && ! hasChildren ) {
            this.add(this.NO, ' ', this.data.of.model_.plural);
          }
        });
      }
    }
  ]
});