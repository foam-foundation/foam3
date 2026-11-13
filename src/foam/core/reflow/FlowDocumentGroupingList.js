/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowDocumentGroupingList',
  extends: 'foam.u2.GridGroupingDAOList',

  documentation: `
    The Knowledge Base list: documents grouped by category, with a jump button
    per category. Each button carries a dot in its category's colour, the same
    colour as the top edge of that category's cards, so the eye can match a
    button to its section.
  `,

  requires: [
    'foam.core.reflow.Flow',
    'foam.core.reflow.FlowDocumentCitationView'
  ],

  css: `
    <<group-nav-dot {
      width: 0.9rem;
      height: 0.9rem;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `,

  properties: [
    [ 'showGroupNav', true ],
    {
      name: 'order',
      // Categories, and the documents of each in reading order, which is name
      // order. Set here, not in the menu journal: a ThenBy read from JSON keeps
      // its head and tail as plain maps, which cannot sort.
      factory: function() { return this.THEN_BY(this.Flow.CATEGORY, this.Flow.NAME); }
    }
  ],

  methods: [
    function renderGroupNavItem(button, g) {
      button.start('span')
        .addClass(this.myClass('group-nav-dot'))
        .style({ background: this.FlowDocumentCitationView.categoryColor(g.group) })
      .end();
      this.SUPER(button, g);
    }
  ]
});
