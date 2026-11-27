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

  cssTokens: [
    // below the app's top bar, and the gap kept from the window's other edges
    { name: 'panelTop',    value: '96px'  },
    { name: 'panelGap',    value: '16px'  },
    { name: 'panelWidth',  value: '460px' },
    { name: 'panelShadow', value: '0 18px 50px rgba(26, 26, 26, 0.18), 0 2px 8px rgba(26, 26, 26, 0.06)' }
  ],

  css: `
    << {
      position: fixed;
      top: $panelTop;
      right: $panelGap;
      bottom: $panelGap;
      width: $panelWidth;
      /* a phone or a narrow window: the panel keeps the gap from each side */
      max-width: calc(100vw - 2 * $panelGap);
      /* the chat fills its parent; the panel's height comes from top and bottom instead */
      height: auto;
      max-height: none;
      min-height: 0;
      z-index: $z-nav;
      box-shadow: $panelShadow;
    }
  `,

  messages: [
    { name: 'WAITING',      message: 'Ready for a question' },
    { name: 'ANSWER_READY', message: 'Answer ready' }
  ],

  properties: [
    {
      // DockItem declares title too; restated so the chat's own title stays
      name: 'title',
      factory: function() { return this.ASK_AI; }
    },
    {
      name: 'running',
      expression: function(isLoading) { return isLoading; }
    },
    {
      name: 'statusMsg',
      // the Dock shows it in a toast when an answer comes while the panel is hidden
      expression: function(isLoading, conversationHistory) {
        return isLoading ? this.THINKING : conversationHistory.length ? this.ANSWER_READY : this.WAITING;
      }
    },
    {
      name: 'cardHidden',
      expression: function(shown) { return shown; }
    },
    [ 'openable', true ]
  ],

  methods: [
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
