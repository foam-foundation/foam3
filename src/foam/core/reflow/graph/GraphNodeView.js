/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphNodeView',
  extends: 'foam.u2.View',

  documentation: `
    Renders one Reflow block as an HTML card inside an SVG <foreignObject>,
    for use inside FlowGraphView. Width is fixed; height is left at 1 on
    render and rewritten directly on the DOM element by FlowGraphView once
    it has measured bodyEl_().offsetHeight for every node.
  `,

  properties: [
    { name: 'nodeName', value: 'foreignObject' },
    {
      name: 'data',
      documentation: 'The Reflow Block this card represents. May be undefined for a node whose block could not be resolved (e.g. a duplicate flowName).'
    },
    { class: 'Int', name: 'width', value: 240 },
    {
      class: 'String',
      name: 'kind',
      documentation: 'One of dao|transform|script|input|doc|layout|other, from FlowGraphView.kindOf().'
    },
    { class: 'StringArray', name: 'summary_' },
    {
      class: 'Boolean',
      name: 'renders',
      documentation: 'Block.rendersOutput, re-read when the block is shown/hidden or the node is refreshed.',
      expression: function(data$shown, summary_) { return !! this.data && this.data.rendersOutput; }
    },
    { class: 'Boolean', name: 'isSelected' },
    { class: 'Boolean', name: 'isDependent' },
    { name: 'body_', hidden: true, transient: true }
  ],

  messages: [
    { name: 'KIND_DAO',       message: 'Data' },
    { name: 'KIND_TRANSFORM', message: 'Transform' },
    { name: 'KIND_SCRIPT',    message: 'Script' },
    { name: 'KIND_INPUT',     message: 'Input' },
    { name: 'KIND_DOC',       message: 'Doc' },
    { name: 'KIND_LAYOUT',    message: 'Layout' },
    { name: 'KIND_OTHER',     message: 'Block' },
    { name: 'HIDDEN_BADGE',   message: 'Hidden' },
    { name: 'SILENT_BADGE',   message: 'No output' },
    { name: 'RENDERS_TIP',    message: 'Renders output' },
    { name: 'SILENT_TIP',     message: 'No visual output' },
    { name: 'LOCKED_BADGE',   message: 'Locked' },
    { name: 'MISSING_BLOCK',  message: '(unresolved block)' }
  ],

  css: `
    ^body {
      background: var(--fg-node-bg);
      border: 1px solid var(--fg-node-border);
      border-radius: 6px;
      color: var(--fg-text);
      overflow: hidden;
      cursor: grab;
      transition: box-shadow 150ms;
    }
    ^header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
    }
    ^bar { height: 4px; }
    ^dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1.5px solid var(--fg-text-muted);
    }
    ^dot-renders {
      background: $success400;
      border-color: $success400;
    }
    ^silent ^body { background: $backgroundSecondary; }
    ^kind-dao ^bar { background: $primary400; }
    ^kind-transform ^bar { background: $purple400; }
    ^kind-script ^bar { background: $orange400; }
    ^kind-input ^bar { background: $success400; }
    ^kind-doc ^bar, ^kind-other ^bar, ^kind-layout ^bar { background: $grey500; }
    ^title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ^badge {
      color: var(--fg-text-muted);
      text-transform: uppercase;
    }
    ^summary {
      padding: 4px 8px 8px;
      color: var(--fg-text-muted);
    }
    ^summary > div {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ^selected ^body {
      border-color: var(--fg-selected);
      box-shadow: 0 0 0 3px var(--fg-selected);
    }
    ^selected ^title { color: var(--fg-selected); }
    ^dependent ^body { box-shadow: 0 0 0 2px var(--fg-dependent); }
    ^error ^body { border-color: var(--fg-error); }
    ^error ^title { color: var(--fg-error); }
    ^hidden-block ^body { border-style: dashed; opacity: 0.7; }
  `,

  methods: [
    function bodyEl_() {
      /** The measurable HTML body element, or null before render(). */
      return this.body_ ? this.body_.el_() : null;
    },

    function kindLabel_(kind) {
      switch ( kind ) {
        case 'dao':       return this.KIND_DAO;
        case 'transform': return this.KIND_TRANSFORM;
        case 'script':    return this.KIND_SCRIPT;
        case 'input':     return this.KIND_INPUT;
        case 'doc':       return this.KIND_DOC;
        case 'layout':    return this.KIND_LAYOUT;
        default:          return this.KIND_OTHER;
      }
    },

    function render() {
      var self = this;
      this.attrs({ x: 0, y: 0, width: this.width, height: 1 });
      this.addClass(this.myClass(), this.myClass('kind-' + ( this.kind || 'other' )));
      this.enableClass(this.myClass('selected'),  this.isSelected$);
      this.enableClass(this.myClass('dependent'), this.isDependent$);

      var data = this.data;
      if ( ! data ) {
        this.body_ = this.start('div', { namespace: 'http://www.w3.org/1999/xhtml' })
          .addClass(this.myClass('body'), 'safari-svg-pos-support')
          .add(this.MISSING_BLOCK)
        .end();
        return;
      }

      this.enableClass(this.myClass('error'), data.error$.map(function(e) { return !! e; }));
      this.enableClass(this.myClass('locked'), data.locked$);
      this.enableClass(this.myClass('hidden-block'), data.shown$.map(function(s) { return ! s; }));
      this.enableClass(this.myClass('silent'), this.renders$.map(function(r) { return ! r; }));

      this.body_ = this.start('div', { namespace: 'http://www.w3.org/1999/xhtml' })
        .addClass(this.myClass('body'), 'safari-svg-pos-support')
        .attrs({ title: data.error$ });
      this.body_.start().addClass(this.myClass('bar')).end();
      this.body_.start().addClass(this.myClass('header'))
        .start().addClass(this.myClass('dot'))
          .enableClass(this.myClass('dot-renders'), this.renders$)
          .attrs({ title: this.renders$.map(function(r) { return r ? self.RENDERS_TIP : self.SILENT_TIP; }) })
        .end()
        .start().addClass(this.myClass('title'), 'p-bold').add(data.flowName$).end()
        .start().addClass(this.myClass('badge'), 'p-xxs').add(this.kindLabel_(this.kind)).end()
        .start().addClass(this.myClass('badge'), 'p-xxs').add(this.HIDDEN_BADGE)
          .show(data.shown$.map(function(s) { return ! s; })).end()
        .start().addClass(this.myClass('badge'), 'p-xxs').add(this.SILENT_BADGE)
          .show(this.slot(function(renders, data$shown) { return ! renders && data$shown !== false; })).end()
        .start().addClass(this.myClass('badge'), 'p-xxs').add(this.LOCKED_BADGE)
          .show(data.locked$).end()
      .end();
      this.body_.start().addClass(this.myClass('summary'), 'p-xs')
        .add(this.dynamic(function(summary_) {
          var e = this;
          ( summary_ || [] ).forEach(function(line) {
            e.start('div').add(line).end();
          });
        }))
      .end();
    }
  ]
});
