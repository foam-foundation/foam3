/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphContainerView',
  extends: 'foam.u2.Element',

  documentation: `
    Renders a container (compound) Reflow block as a background rect sized
    to fit its children, with a header row showing its name and child
    count. FlowGraphView draws the children themselves as ordinary leaf
    nodes in a separate DOM layer above this one, and sets width/height
    once it has laid out those children.
  `,

  constants: [
    {
      type: 'Int',
      name: 'HEADER_HEIGHT',
      value: 28,
      documentation: 'Height of the header row; FlowGraphView reserves this much above the children.'
    }
  ],

  properties: [
    { name: 'nodeName', value: 'g' },
    { name: 'data', documentation: 'The container Block this view represents.' },
    { class: 'Int', name: 'width' },
    { class: 'Int', name: 'height' },
    { class: 'Int', name: 'childCount' },
    { class: 'Boolean', name: 'isSelected' },
    { class: 'Boolean', name: 'isDependent' }
  ],

  messages: [
    { name: 'LAYOUT_BADGE', message: 'Layout' }
  ],

  css: `
    ^container {
      fill: $backgroundTertiary;
      fill-opacity: 0.6;
      stroke: $borderDefault;
      stroke-dasharray: 4 4;
    }
    ^selected ^container { stroke: $primary400; stroke-width: 2; }
    ^dependent ^container { stroke: $orange400; }
    ^header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
    }
    ^title {
      color: var(--fg-text);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ^badge {
      color: var(--fg-text-muted);
      text-transform: uppercase;
    }
  `,

  methods: [
    function childCountLabel_(n) {
      n = n || 0;
      return n + ' block' + ( n === 1 ? '' : 's' );
    },

    function render() {
      var self = this;
      this.addClass(this.myClass());
      this.enableClass(this.myClass('selected'),  this.isSelected$);
      this.enableClass(this.myClass('dependent'), this.isDependent$);

      this.start('rect')
        .addClass(this.myClass('container'))
        .attrs({ rx: 8, x: 0, y: 0, width: this.width$, height: this.height$ })
      .end();

      this.start('foreignObject')
        .attrs({ x: 0, y: 0, width: this.width$, height: this.HEADER_HEIGHT })
        .start('div', { namespace: 'http://www.w3.org/1999/xhtml' })
          .addClass(this.myClass('header'), 'safari-svg-pos-support')
          .start().addClass(this.myClass('title'), 'p-bold')
            .add(this.data ? this.data.flowName$ : '')
          .end()
          .start().addClass(this.myClass('badge'), 'p-xxs').add(this.LAYOUT_BADGE).end()
          .start().addClass(this.myClass('badge'), 'p-xxs')
            .add(this.childCount$.map(function(n) { return self.childCountLabel_(n); }))
          .end()
        .end()
      .end();
    }
  ]
});
