/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.ai.llm',
  name: 'RAGChatPanel',
  extends: 'foam.ai.llm.RAGChat',
  implements: [ 'foam.u2.dock.DockItem' ],

  documentation: `
    The Ask AI chat as a panel on the right of the screen, docked in the app's
    Dock so it stays open while the user walks the app: a source link opens a
    document and the chat stays beside it. Hide keeps the chat, and its card
    at the bottom right opens it again; Close ends it. Opened from a menu by
    foam.u2.dock.DockMenu.
  `,

  imports: [ 'dock?' ],

  css: `
    << {
      position: fixed;
      top: 96px;
      right: 16px;
      bottom: 16px;
      width: 460px;
      /* a phone or a narrow window: the panel keeps 16px from each side */
      max-width: calc(100vw - 32px);
      /* the chat fills its parent; the panel's height comes from top and bottom instead */
      height: auto;
      max-height: none;
      min-height: 0;
      z-index: $z-nav;
      box-shadow: 0 18px 50px rgba(26, 26, 26, 0.18), 0 2px 8px rgba(26, 26, 26, 0.06);
    }
  `,

  messages: [
    { name: 'WAITING', message: 'Ready for a question' }
  ],

  properties: [
    {
      // DockItem declares title too; restated so the chat's own title stays
      name: 'title',
      factory: function() { return this.ASK_AI; }
    },
    {
      class: 'Boolean',
      name: 'shown',
      value: true,
      documentation: 'Whether the panel shows. Hiding it keeps the chat; its Dock card shows instead.'
    },
    {
      name: 'running',
      expression: function(isLoading) { return isLoading; }
    },
    {
      name: 'statusMsg',
      expression: function(isLoading) { return isLoading ? this.THINKING : this.WAITING; }
    },
    {
      name: 'cardHidden',
      expression: function(shown) { return shown; }
    },
    [ 'openable', true ]
  ],

  methods: [
    function render() {
      this.SUPER();
      this.show(this.shown$);
    },

    function renderHeaderActions(self) {
      this.startContext({ data: self })
        .tag(self.CLEAR,      { buttonStyle: 'TERTIARY' })
        .tag(self.HIDE_PANEL, { buttonStyle: 'TERTIARY', label: '', themeIcon: 'minus' })
        .tag(self.CLOSE,      { buttonStyle: 'TERTIARY', label: '', themeIcon: 'close' })
      .endContext();
    },

    function open() {
      this.shown = true;
    }
  ],

  actions: [
    {
      name: 'hidePanel',
      label: 'Hide',
      toolTip: 'Hide the chat. Open it again from its card at the bottom right.',
      code: function() { this.shown = false; }
    },
    {
      name: 'close',
      toolTip: 'Close the chat.',
      code: function() {
        this.shown = false;
        this.dock?.undock(this);
      }
    }
  ]
});
