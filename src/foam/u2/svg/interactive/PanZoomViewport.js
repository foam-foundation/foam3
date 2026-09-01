/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.svg.interactive',
  name: 'PanZoomViewport',
  extends: 'foam.u2.Element',
  documentation: `
    An <svg> root that owns a single transformed <g> layer. Consumers
    add()/start()/tag() children into this element as usual; render()
    redirects those calls into the layer via the 'content' property, so
    every child ends up inside the pan/zoom transform.

    matrix is the single source of truth for the view transform. Dragging
    the background pans; wheel zooms toward the cursor.
  `,

  css: `
    ^ {
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
    }
    ^background {
      fill: transparent;
    }
  `,

  properties: [
    ['nodeName', 'svg'],
    {
      name: 'matrix',
      factory: function () { return new DOMMatrix(); },
      documentation: 'Single source of truth for the view transform.'
    },
    {
      class: 'Float',
      name: 'zoom',
      value: 1,
      documentation: 'Mirrors matrix.a after every change; read-only for consumers.'
    },
    {
      class: 'Float',
      name: 'minZoom',
      value: 0.15
    },
    {
      class: 'Float',
      name: 'maxZoom',
      value: 4
    },
    'layer_',
    'background_',
    'pan_'
  ],

  methods: [
    function render () {
      this.addClass(this.myClass()).attrs({ xmlns: 'http://www.w3.org/2000/svg' });
      this
        .on('wheel', this.onWheel, { passive: false })
        .on('pointerdown', this.onPointerDown)
        .on('pointermove', this.onPointerMove)
        .on('pointerup', this.onPointerUp)
        .on('pointercancel', this.onPointerUp);

      this.layer_ = this.start('g').addClass(this.myClass('layer'));
      // Note: no .end() here -- attrs()/addClass() return the rect itself,
      // and .end() would instead return its parent (layer_).
      this.background_ = this.layer_
        .start('rect')
          .addClass(this.myClass('background'))
          .attrs({ x: -1e5, y: -1e5, width: 2e5, height: 2e5 });

      // Children added by consumers from here on land inside the
      // transformed layer instead of directly under the <svg> root.
      this.content = this.layer_;

      this.apply_();
    },
    function apply_ () {
      /* Writes matrix to the layer's transform attribute (not
         style.transform) so it is reflected in getScreenCTM(), which
         Draggable relies on to convert pointer events into user space. */
      const m = this.matrix;
      this.layer_.attrs({ transform: `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})` });
      this.zoom = m.a;
    },
    function clientToUser (clientX, clientY) {
      const r = this.el_().getBoundingClientRect();
      return new DOMPoint(clientX - r.left, clientY - r.top).matrixTransform(this.matrix.inverse());
    },
    function panBy (dx, dy) {
      /* dx, dy are a screen-space delta. */
      this.matrix = new DOMMatrix().translateSelf(dx, dy).multiplySelf(this.matrix);
      this.apply_();
    },
    function zoomAt (clientX, clientY, factor) {
      const r = this.el_().getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const target = Math.min(this.maxZoom, Math.max(this.minZoom, this.matrix.a * factor));
      const f = target / this.matrix.a;
      if ( f === 1 ) return;
      this.matrix = new DOMMatrix()
        .translateSelf(px, py)
        .scaleSelf(f)
        .translateSelf(-px, -py)
        .multiplySelf(this.matrix);
      this.apply_();
    },
    function centerOn (x, y, opt_zoom) {
      /* Puts user-space point (x, y) at the middle of the viewport. */
      const el = this.el_();
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if ( ! vw || ! vh ) return;
      const z = Math.min(this.maxZoom, Math.max(this.minZoom, opt_zoom === undefined ? this.matrix.a : opt_zoom));
      this.matrix = new DOMMatrix().translateSelf(vw / 2 - x * z, vh / 2 - y * z).scaleSelf(z);
      this.apply_();
    },
    function fit (bounds, pad) {
      /* bounds = { x, y, width, height } in user units. */
      if ( pad === undefined ) pad = 40;
      const el = this.el_();
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if ( ! vw || ! vh || ! bounds.width || ! bounds.height ) return;
      const s = Math.min(
        this.maxZoom,
        Math.max(
          this.minZoom,
          Math.min((vw - 2 * pad) / bounds.width, (vh - 2 * pad) / bounds.height)
        )
      );
      this.matrix = new DOMMatrix()
        .translateSelf(
          (vw - bounds.width * s) / 2 - bounds.x * s,
          (vh - bounds.height * s) / 2 - bounds.y * s)
        .scaleSelf(s);
      this.apply_();
    }
  ],

  listeners: [
    function onWheel (evt) {
      evt.preventDefault();
      const dy = evt.deltaMode === 1 ? evt.deltaY * 16 : evt.deltaY;
      this.zoomAt(evt.clientX, evt.clientY, Math.exp(-dy * 0.0015));
    },
    function onPointerDown (evt) {
      // Pan only from the background rect: left button without shift, or
      // middle button. Shift+left is reserved for consumers (marquee
      // selection).
      if ( evt.target !== this.background_.el_() ) return;
      if ( ! ( evt.button === 1 || ( evt.button === 0 && ! evt.shiftKey ) ) ) return;
      this.el_().setPointerCapture(evt.pointerId);
      this.pan_ = { x: evt.clientX, y: evt.clientY };
    },
    function onPointerMove (evt) {
      if ( ! this.pan_ ) return;
      this.panBy(evt.clientX - this.pan_.x, evt.clientY - this.pan_.y);
      this.pan_ = { x: evt.clientX, y: evt.clientY };
    },
    function onPointerUp (evt) {
      this.pan_ = undefined;
    }
  ]
});
