/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.u2',
  name: 'Tooltip',
  extends: 'foam.u2.View',

  documentation: 'Tooltip handler for any class extending Element',

  imports: [ 'window' ],

  requires: [ 'foam.u2.TooltipView' ],

  properties: [
    {
      name: 'text',
      documentation: 'Help text to show in the tooltip.',
      required: true
    },
    {
      name: 'target',
      documentation: 'The tooltip will be positioned relative to this element.',
      required: true
    },
    'timer',
    'screenWidth',
    'top',
    'left',
    'right',
    'tooltipStore'
  ],

  methods: [
    function init() {
      this.target.removeAttribute('title'); // prevents regular tooltips
      this.target.on('mouseover', this.loadTooltip);
      this.target.onDetach(this.close);
      this.SUPER();
    },

    async function setTooltip(evt) {
      var el            = await this.target.el();
      this.tooltipStore = this.TooltipView.create({ data: this.text });
      var domRect       = el.getBoundingClientRect();
      this.screenWidth  = this.window.innerWidth;
      var screenHeight  = this.window.innerHeight;
      var scrollY       = this.window.scrollY;
      var height        = this.tooltipStore.getBoundingClientRect().height;
      this.top = (domRect.top - scrollY > screenHeight / 2) ?
        evt.pageY - 30 - height : evt.pageY + 20;
      if ( domRect.left > 3 * (this.screenWidth / 4) ) {
        this.left = 'auto';
        this.right = this.screenWidth - evt.pageX + 10;
      } else {
        this.left = evt.pageX + 10;
        this.right = 'auto';
      }
      this.tooltipStore.style({
        'max-width': (this.screenWidth / 2)+'px',
          'top':   this.top$,
          'left':  this.left$,
          'right': this.right$
      });
      this.tooltipStore.write();
    }
  ],

  listeners: [
    function onMouseOver(evt) {
      if ( this.timer !== undefined ) {
        clearTimeout(this.timer);
      }
      this.timer = setTimeout(() => {
        this.setTooltip(evt);
      }, 500);
      this.target.on('mousemove', evt => {
        this.close();
        this.setTooltip(evt);
      });
    },

    function close() {
      if ( this.tooltipStore ) {
        this.tooltipStore.remove();
      }
      clearTimeout(this.timer);
    },

    async function loadTooltip(evt) {
      if ( ! this.target ) {
        console.error('Target not found');
        return;
      }

      var el = await this.target.el();

      this.target.on('mouseover',  this.onMouseOver);
      this.target.on('mousedown',  this.close);
      this.target.on('mouseleave', this.close);
      this.target.on('mouseout',   this.close);
      this.target.on('touchstart', this.close, {passive: true});
      this.target.on('unload',     this.close);
      this.onMouseOver(evt);
    }
  ]
});


foam.CLASS({
  package: 'foam.u2',
  name: 'TooltipView',
  extends: 'foam.u2.View',

  documentation: 'Tooltip view to be used by the tooltip handler',

  css: `
    ^ {
      background: $backgroundInverseSecondary;
      border-radius: 5px;
      color: $white;
      padding: 5px 8px;
      position: absolute;
      z-index: 2000;
    }
  `,

  methods: [
    function render(data) {
      this.SUPER();
      this
        .show(this.data$)
        .add(this.data)
        .addClass()
    }
  ]
});
