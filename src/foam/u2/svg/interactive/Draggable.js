/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.svg.interactive',
  name: 'Draggable',
  extends: 'foam.u2.Element',
  documentation: `
    A draggable element that positions itself using an SVG transform.
  `,

  properties: [
    ['nodeName', 'g'],
    {
      class: 'FObjectProperty',
      of: 'foam.u2.svg.Position',
      name: 'pos'
    },
    'dragState_'
  ],

  topics: [
    'dragStart',
    'drag',
    'dragEnd'
  ],

  methods: [
    function render () {
      this
        .on('pointerdown', this.onPointerDown)
        .on('pointermove', this.onPointerMove)
        .on('pointerup', this.onPointerUp)
        .on('pointercancel', this.onPointerUp);
      this.pos.bind(this);
    },
    function toUser_ (evt) {
      /* Converts a pointer event's client coordinates into the coordinate
         space of this element's parent, accounting for every transform
         (pan/zoom viewport, viewBox scale, ...) between the parent and the
         screen. */
      const ctm = this.el_().parentNode.getScreenCTM();
      return new DOMPoint(evt.clientX, evt.clientY).matrixTransform(ctm.inverse());
    }
  ],

  listeners: [
    function onPointerDown (evt) {
      if ( evt.button !== 0 ) return;
      this.el_().setPointerCapture(evt.pointerId);
      this.dragState_ = {
        origin: this.toUser_(evt),
        self: { x: this.pos.x, y: this.pos.y },
        moved: false
      };
      this.dragStart.pub();
    },
    function onPointerMove (evt) {
      if ( ! this.dragState_ ) return;
      const p = this.toUser_(evt);
      const dx = p.x - this.dragState_.origin.x;
      const dy = p.y - this.dragState_.origin.y;
      this.pos.x = this.dragState_.self.x + dx;
      this.pos.y = this.dragState_.self.y + dy;
      this.dragState_.moved = true;
      this.drag.pub(dx, dy);
    },
    function onPointerUp (evt) {
      if ( ! this.dragState_ ) return;
      const moved = this.dragState_.moved;
      this.dragState_ = undefined;
      this.dragEnd.pub(moved);
    }
  ]
});
