/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.dock',
  name: 'Dock',
  extends: 'foam.u2.View',

  documentation: `
    Bottom-right stack of cards, one per DockItem, that stays on screen on
    every menu: work keeps being visible while the user walks the app. Any
    code docks an item and keeps the item's properties current; the card
    follows them.

      dock.dock(item);     // card appears; the Dock adds itself to ctrl on first use
      dock.undock(item);   // card goes, and a view item leaves the app shell

    An item that is a view (a foam.u2.Element) is added to ctrl too when it
    docks, so a screen can start work that keeps its own view, such as an
    agent's panel, and the view stays after the screen goes. The item hides
    its card with cardHidden while that view shows, and can draw its own card
    with cardView.

    The collapse control shrinks every card to a pill holding its percent or
    its running time; the next item to dock after the stack empties opens
    expanded again. A click on an openable card calls item.open(). When an
    item stops running the Dock notifies the user once, and while any item
    holdsPage, leaving or reloading the page asks first.

    Registered as a client-only CSpec service (dock in services.jrl,
    lazyClient: false) rather than a singleton, so every caller that imports
    'dock?' resolves the same context-scoped instance.

    Non-blocking by design, and the DOM is rebuilt only when the set of
    items changes: everything that moves while an item works rides a slot of
    that item, and the running time rides tick_, bumped once a second only
    while some running item has a startTime.
  `,

  requires: [
    'foam.lang.ExpressionSlot',
    'foam.u2.ProgressView'
  ],

  imports: [ 'ctrl?', 'notify?' ],

  css: `
    << {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: $z-toast;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      max-width: 320px;
    }
    <<card {
      width: 320px;
      box-sizing: border-box;
      background: $backgroundDefault;
      border: 1px solid $borderDefault;
      border-radius: $inputBorderRadius;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      padding: 4px 12px 12px 12px;
    }
    <<openable {
      cursor: pointer;
      transition: background-color 150ms ease-out;
    }
    <<openable:hover {
      background: $backgroundHover;
    }
    <<header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    <<name {
      flex: 1;
      padding-top: 12px;
      color: $textSecondary;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    <<toggle {
      min-width: 44px;
      min-height: 44px;
      background: none;
      border: none;
      border-radius: $inputBorderRadius;
      color: $textSecondary;
      cursor: pointer;
      transition: background-color 150ms ease-out;
    }
    <<toggle:hover {
      background: $backgroundHover;
    }
    <<bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    <<bar progress {
      flex: 1;
      width: auto;
    }
    <<pct {
      min-width: 3.2em;
      text-align: right;
      color: $textSecondary;
    }
    <<indeterminate {
      width: 100%;
      height: 8px;
    }
    <<status {
      margin-top: 4px;
      color: $textSecondary;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    <<pills {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    <<pill {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      padding: 0 12px;
      background: $backgroundDefault;
      border: 1px solid $borderDefault;
      border-radius: 22px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      color: $textSecondary;
      cursor: pointer;
      transition: background-color 150ms ease-out;
    }
    <<pill:hover {
      background: $backgroundHover;
    }
    @media (prefers-reduced-motion: reduce) {
      <<toggle, <<pill, <<openable {
        transition: none;
      }
    }
  `,

  messages: [
    { name: 'HIDE_STATUS', messageMap: { en: 'Hide status', fr: 'Masquer l\'état' } },
    { name: 'SHOW_STATUS', messageMap: { en: 'Show status', fr: 'Afficher l\'état' } }
  ],

  properties: [
    {
      class: 'Array',
      name: 'items',
      documentation: 'The docked items, in the order they docked; the only thing that rebuilds the cards.'
    },
    {
      class: 'Map',
      name: 'subs_',
      documentation: 'The running$ subscription of each docked item, by $UID, detached on undock.',
      factory: function() { return {}; }
    },
    {
      class: 'Int',
      name: 'tick_',
      documentation: 'Bumped once a second while some running item has a startTime; drives the running-time text.'
    },
    {
      name: 'timer_',
      documentation: 'The interval that bumps tick_, or null when no card counts up.'
    },
    { class: 'Boolean', name: 'collapsed_' },
    { class: 'Boolean', name: 'attached_' }
  ],

  methods: [
    function init() {
      this.SUPER();
      // The service lives as long as the page, so this listener never needs
      // removing; it only asks while an item holds the page.
      globalThis.addEventListener?.('beforeunload', this.onBeforeUnload);
    },

    function dock(item) {
      if ( this.items.indexOf(item) != -1 ) return;
      var self = this;
      this.subs_[item.$UID] = item.running$.sub(function() {
        if ( ! item.running && ! item.cardHidden && self.items.indexOf(item) != -1 ) self.notifyUser_(item.title + ': ' + item.statusMsg);
        self.updateTimer_();
      });
      this.items = this.items.concat([ item ]);
      this.updateTimer_();
      // The service is instantiated in the client context (eager CSpec),
      // which is the PARENT of ApplicationController's subcontext -- the
      // 'ctrl' export lives in the child, so the import resolves undefined
      // here. Fall back to the application's browser global.
      var c = this.ctrl || globalThis.ctrl;
      if ( ! this.attached_ && c ) {
        this.attached_ = true;
        c.add(this);
      }
      // a view item joins the app shell once, unless it is already on the page
      if ( c && foam.u2.Element.isInstance(item) && ! item.element_?.isConnected ) c.add(item);
    },

    // Like ctrl, notify is exported by ApplicationController's subcontext, a
    // child of the client context this service is created in, so the import
    // resolves undefined in the app; fall back to the application's global.
    function notifyUser_(msg) {
      if ( this.notify ) return this.notify(msg);
      globalThis.ctrl?.notify?.(msg);
    },

    function undock(item) {
      if ( this.items.indexOf(item) == -1 ) return;
      this.subs_[item.$UID]?.detach();
      delete this.subs_[item.$UID];
      this.items = this.items.filter(function(i) { return i !== item; });
      // A view docking added itself to the app shell, so leaving takes it out
      if ( foam.u2.Element.isInstance(item) && item.element_ ) item.remove();
      // The next item opens expanded, whatever the user chose for these.
      if ( ! this.items.length ) this.collapsed_ = false;
      this.updateTimer_();
    },

    function updateTimer_() {
      var counting = this.items.some(function(i) { return i.running && i.startTime; });
      if ( counting && ! this.timer_ ) {
        this.timer_ = setInterval(() => this.tick_++, 1000);
      } else if ( ! counting && this.timer_ ) {
        clearInterval(this.timer_);
        this.timer_ = null;
      }
    },

    function elapsed_(item) {
      if ( ! item.running || ! item.startTime ) return '';
      var s = Math.max(0, Math.floor((Date.now() - item.startTime.getTime()) / 1000));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },

    // The item's statusMsg with how long it has run, e.g. "Saving this
    // format · 2:10", as a slot owned by el. Public so a cardView shows the
    // same line as the plain card.
    function statusText(el, item) {
      var self = this;
      // Owned by the element, not the Dock: the Dock outlives every card, so
      // slots parented to it would pile up and be notified on every tick.
      return el.onDetach(this.ExpressionSlot.create({
        args: [ item.statusMsg$, item.running$, item.startTime$, this.tick_$ ],
        code: function(statusMsg) {
          var t = self.elapsed_(item);
          return t ? statusMsg + ' \u00b7 ' + t : statusMsg;
        }
      }));
    },

    function pillText_(el, item) {
      var self = this;
      return el.onDetach(this.ExpressionSlot.create({
        args: [ item.title$, item.progress$, item.running$, item.startTime$, this.tick_$ ],
        code: function(title, progress) {
          if ( progress >= 0 ) return progress + '%';
          var t = self.elapsed_(item);
          return t ? title + ' \u00b7 ' + t : title;
        }
      }));
    },

    // A card hides while the stack is collapsed to pills, and while the
    // item's own view shows.
    function cardHidden_(el, item) {
      return el.onDetach(this.ExpressionSlot.create({
        args: [ this.collapsed_$, item.cardHidden$ ],
        code: function(collapsed, cardHidden) { return collapsed || cardHidden; }
      }));
    },

    function renderToggle(self) {
      this.start('button').addClass(self.myClass('toggle')).
        attrs({
          'aria-label':    self.HIDE_STATUS,
          'aria-expanded': true,
          title:           self.HIDE_STATUS
        }).
        on('click', function(e) { e.stopPropagation(); self.collapsed_ = true; }).
        add('–').
      end();
    },

    function renderBar(self, item) {
      // Both bars are built once and shown off progress, so a load that
      // learns its size part way through costs no rebuild. The bar with no
      // max/value attributes renders the native indeterminate animation.
      this.start().show(item.showProgress$).
        start().addClass(self.myClass('bar')).show(item.progress$.map(p => p >= 0)).
          start(self.ProgressView, { data$: item.progress$ }).end().
          start().addClass('p-sm', self.myClass('pct')).add(item.progress$.map(p => p + '%')).end().
        end().
        start('progress').addClass(self.myClass('indeterminate')).show(item.progress$.map(p => p < 0)).end().
      end();
    },

    function renderCard(self, item) {
      if ( item.cardView ) {
        this.start().hide(self.cardHidden_(this, item)).
          tag(item.cardView, { data: item }).
        end();
        return;
      }
      this.start().addClass(self.myClass('card')).
        enableClass(self.myClass('openable'), item.openable$).
        hide(self.cardHidden_(this, item)).
        on('click', function() { if ( item.openable ) item.open(); }).
        start().addClass(self.myClass('header')).
          start().addClass('p-sm', 'p-bold', self.myClass('name')).
            attrs({ title: item.title$ }).
            add(item.title$).
          end().
          call(self.renderToggle, [self]).
        end().
        call(self.renderBar, [self, item]).
        start().addClass('p-sm', self.myClass('status')).
          add(self.statusText(this, item)).
        end().
      end();
    },

    function render() {
      this.SUPER();
      var self = this;
      // If the element is later detached (e.g. ctrl.add()'d content torn
      // down and rebuilt), clear attached_ so the next dock() re-adds it --
      // the instance itself is unchanged since it's resolved via context
      // import, not re-created per attach.
      this.onDetach(function() {
        self.attached_ = false;
      });
      this.addClass().
        attrs({ 'aria-live': 'polite', role: 'status' }).
        add(this.dynamic(function(items) {
          // Collapsing is a visibility flip, not a change of structure: cards
          // and pills are built once and shown/hidden off collapsed_.
          this.forEach(items, function(item) {
            this.call(self.renderCard, [self, item]);
          });
          this.start().addClass(self.myClass('pills')).show(self.collapsed_$).
            forEach(items, function(item) {
              this.start('button').addClass(self.myClass('pill')).
                hide(item.cardHidden$).
                attrs({
                  'aria-label':    self.SHOW_STATUS,
                  'aria-expanded': false,
                  title:           item.title$
                }).
                on('click', function() { self.collapsed_ = false; }).
                start().addClass('p-sm', 'p-bold').add(self.pillText_(this, item)).end().
              end();
            }).
          end();
        }));
    }
  ],

  listeners: [
    function onBeforeUnload(e) {
      if ( ! this.items.some(function(i) { return i.holdsPage; }) ) return;
      // Browsers show their own wording; the call is what makes them ask.
      e.preventDefault();
      e.returnValue = '';
    }
  ]
});
