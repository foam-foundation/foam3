/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'BreadcrumbBorder',
  extends: 'foam.u2.Element',

  documentation: `
    A border that adds breadcrumb functionality to any view, if no breadcrumbs are available
    it shows a back button to the default menu
  `,

  imports: ['stack?'],
  requires: ['foam.u2.stack.BreadcrumbView'],
  css: `
    << {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
      padding: 8px;
      height: 100%
    }
    <<content {
      flex: 1;
      width: 100%;
    }
    << {
      border-left: 4px solid $borderDefault;
      padding-left: 16px;
    }
  `,

  methods: [
    function init() {
      let showBack = this.stack.stack_?.slice(0, this.stack.pos).length < 1 ?? true;
      this
      .addClass()
      .callIfElse(showBack, function() {
        this.tag(this.BACK);
      }, function() {
        this.tag(this.BreadcrumbView);
      })
      .start('', null, this.content$)
        .addClass(this.myClass('content'))
      .end();
    }
  ],

  actions: [
    {
      name: 'back',
      themeIcon: 'back',
      buttonStyle: 'LINK',
      code: function(X) {
        X.pushDefaultMenu();
      }
    }
  ]
});
