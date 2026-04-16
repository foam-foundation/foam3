/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: Investigate if we can autoclose on scroll

foam.CLASS({
  package: 'foam.u2.md',
  name: 'OverlayDropdown',
  extends: 'foam.u2.Element',

  imports: [ 'document', 'window' ],

  exports: [
    'as dropdown'
  ],

  documentation: `A popup overlay that grows from the top-right corner of
    its container. Useful for e.g. "..." overflow menus in action bars.
    Just $$DOC{ref:".add"} things to this container.`,

  css: `
    ^overlay {
      position: absolute;
      z-index: 1009;
    }

    ^ {
      display: block;
      overflow-x: hidden;
      overflow-y: hidden;
      position: absolute;
      z-index: 1010;
      max-width: 100%;
    }

    ^styled{
      background-color: $backgroundDefault;
      border: 1px solid $borderDefault;
      box-sizing: border-box;
      box-shadow: 0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05);
      border-radius: 4px;
      padding: 8px;
    }

    ^open {
      overflow-y: auto;
    }

    ^zeroOverlay {
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
    }

    ^initialOverlay {
      top: initial;
      bottom: initial;
      left: initial;
      right: initial;
    }

    ^parents {
      z-index: 1000 !important;
    }
    @media print {
      ^ { display: none !important; }
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'opened',
      documentation: 'True when the overlay has been commanded to be open.'
    },
    {
      name: 'dropdownE_',
      factory: function() {
        return this.E('dropdown');
      }
    },
    {
      name: 'addToSelf_',
      value: false
    },
    {
      name: 'left'
    },
    {
      name: 'right'
    },
    {
      name: 'top'
    },
    {
      name: 'bottom'
    },
    'parentEl',
    {
      class: 'Boolean',
      name: 'closeOnLeave',
      value: true
    },
    {
      class: 'Boolean',
      name: 'styled',
      value: true
    },
    {
      class: 'Int',
      name: 'parentEdgePadding',
      documentation: `When set, the dropdown will stick itself to the parentEl's edge`,
      value: -1
    },
    {
      class: 'Boolean',
      name: 'lockToParentWidth'
    },
    'ro_', 'x', 'y', 'internalResizeObserver_'
  ],

  methods: [
    function add() {
      // TODO: Replace with content @kgr
      if ( this.addToSelf_ ) {
        this.SUPER(...arguments);
      } else {
        this.dropdownE_.add(...arguments);
      }

      return this;
    },

    function open(x, y) {
      this.x = x; this.y = y;
      this.setPosition();
      this.ro_?.observe(this.parentEl);
      this.internalResizeObserver_?.observe(this.dropdownE_.el_())
      this.opened = true;
      this.window.addEventListener('resize', this.onResize);
    },

    function setPosition() {
      var screenWidth  = this.window.innerWidth;
      var domRect      = this.parentEl.getBoundingClientRect();
      var screenHeight = this.window.innerHeight;
      var scrollY      = this.window.scrollY;
      var parentCheck  = this.parentEdgePadding > -1;
      if ( domRect.top - scrollY < screenHeight / 2 ) {
        this.top = parentCheck ? domRect.bottom + this.parentEdgePadding : this.y;
        this.bottom = 'auto';
      } else {
        this.top = 'auto';
        this.bottom = parentCheck ?
          screenHeight - domRect.top + this.parentEdgePadding : screenHeight - this.y;
      }
      if ( domRect.left > 3 * (screenWidth / 4) ) {
        this.left = 'auto';
        this.right = parentCheck ? screenWidth - domRect.right : screenWidth - this.x + 10;
      } else if (domRect.left < 75) {
        this.left = parentCheck ? domRect.left : this.x + 10;
        this.right = 'auto';
      } else {
        this.left = parentCheck ? domRect.left : this.x - 75;
        this.right = 'auto';
      }
    },

    function setHeight() {
      var el = this.dropdownE_.el_?.();
      var contentHeight = el.scrollHeight || el.offsetHeight || 0;
      var screenHeight = this.window.innerHeight;
      let availableHeight;
      if ( this.top == 'auto' ) {
        availableHeight = screenHeight - this.bottom;
      } else {
        availableHeight = screenHeight - this.top;
      }
      if ( contentHeight > availableHeight ) {
        availableHeight = Math.max(0, availableHeight - 8);
        el.style.maxHeight = availableHeight + 'px';
        el.style.overflowY = 'auto';
      } else {
        el.style.maxHeight = '';
        el.style.overflowY = '';
      }
    },

    function close() {
      this.opened = false;
      this.ro_?.unobserve(this.parentEl);
      this.internalResizeObserver_?.unobserve(this.dropdownE_.el_())
    },

    function render() {
      this.addToSelf_ = true;
      this.addClass(this.myClass('container'));
      var view = this;
      let fn = () => {
        if ( ! this.parentEl ) return;
        this.ro_ = new ResizeObserver(() => {
          if ( this.lockToParentWidth ) {
            this.dropdownE_.el_().style.width = this.parentEl.getBoundingClientRect().width;
          }
          this.setPosition();
        });
        this.onDetach(() => { this.ro_?.disconnect(); })
      }
      this.parentEl$.sub(fn);
      fn();

      this.internalResizeObserver_ = new ResizeObserver(() => {
        if ( this.opened )
          this.setHeight();
      });
      this.onDetach(() => { this.internalResizeObserver_?.disconnect(); })

      this.addClass(this.slot(function(opened) {
        this.shown = opened;
      }, this.opened$));
      this.start('dropdown-overlay')
        .addClass(this.myClass('overlay'))
        .show(this.opened$)
        .addClass(this.slot(function(opened) {
          return opened
            ? view.myClass('zeroOverlay')
            : view.myClass('initialOverlay');
        }, this.opened$))
        .on('click', this.onCancel)
      .end();

      this.dropdownE_.addClass(this.myClass())
        .enableClass(this.myClass('styled'), this.styled$)
        .show(this.opened$)
        .style({
          top: this.top$,
          left: this.left$,
          right: this.right$,
          bottom: this.bottom$
        })
        .callIf(this.closeOnLeave, function() {
          this
          .on('mouseenter', this.onMouseEnter)
          .on('mouseleave', this.onMouseLeave)
        })
        .on('keydown', this.onKeyDown)
        .on('click', this.onClick);

      this.add(this.dropdownE_);

      this.addToSelf_ = false;

    }
  ],

  listeners: [
    function onCancel() {
      this.close();
    },

    function onKeyDown(e) {
      var isEsc = (e.key === 'Escape' || e.keyCode === 27);
      if ( isEsc ) { this.close(); this.document.getElementById(this.parentEl.id).focus(); }
    },

    function onMouseEnter(e) {
      if ( this.timer !== undefined ) {
        clearTimeout(this.timer);
      }
    },

    function onMouseLeave(e) {
      console.assert(e.target === this.dropdownE_.el_(),
          'mouseleave should only fire on this, not on children');
      // If mouse moves to a nested dropdown, do not close the parent dropdown
      if ( e.toElement?.nodeName == 'DROPDOWN' || ! this.closeOnLeave ) return;
      this.timer = setTimeout(() => { this.close(); }, 500);
    },

    /**
     * Prevent clicks inside the dropdown from closing it.
     * Block them before they reach the overlay.
     */
    function onClick(e) {
      e.stopPropagation();
    },

    function onResize(e) {
      this.setPosition();
      window.removeEventListener('resize', onResize);
    }
  ]
});
