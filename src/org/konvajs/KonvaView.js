/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs',
  name: 'KonvaView',
  extends: 'foam.u2.View',

  documentation: `Wraps a Konva Stage in a FOAM View.

    The org.konvajs.Lib mixin installs a JsLib axiom which wraps render() to
    await the Konva script, so window.Konva is guaranteed present by the time
    render() runs - no polling required.

    'onStageReady' is invoked as a property of this view, so a caller passing a
    method of its own object must bind it.

    Set 'fillContainer' for a canvas that tracks its element's size, and
    'pannable'/'zoomable' for whiteboard-style navigation.`,

  mixins: [
    'org.konvajs.Lib'
  ],

  properties: [
    {
      class: 'Simple',
      name: 'stage'
    },
    {
      class: 'Simple',
      name: 'layer',
      documentation: 'The default layer, also passed to onStageReady.'
    },
    {
      class: 'Int',
      name: 'width',
      value: 500
    },
    {
      class: 'Int',
      name: 'height',
      value: 500
    },
    {
      class: 'Boolean',
      name: 'fillContainer',
      documentation: `Sizes the stage to its container element and keeps it in
        sync with a ResizeObserver, instead of using the fixed width/height.`
    },
    {
      class: 'Boolean',
      name: 'pannable',
      documentation: `Drag on empty canvas pans the stage. Dragging a draggable
        shape still moves that shape - Konva gives the shape precedence.`
    },
    {
      class: 'Boolean',
      name: 'zoomable',
      documentation: 'Mouse wheel zooms the stage, centred on the pointer.'
    },
    {
      class: 'Float',
      name: 'minScale',
      value: 0.2
    },
    {
      class: 'Float',
      name: 'maxScale',
      value: 5
    },
    {
      class: 'Float',
      name: 'scaleStep',
      documentation: 'Zoom factor applied per wheel notch.',
      value: 1.05
    },
    {
      class: 'Function',
      name: 'onStageReady',
      documentation: 'Called with (stage, layer) once the stage is created.',
      value: function(stage, layer) { }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this.style({
        display:  'block',
        position: 'relative'
      });

      if ( this.fillContainer ) {
        this.style({ width: '100%', height: '100%' });
      } else {
        this.style({
          width:  this.width + 'px',
          height: this.height + 'px'
        });
      }

      this.el().then(function(el) {
        // Guard against the element going away while el() was pending.
        if ( el ) self.initKonva(el);
      });
    },

    function initKonva(el) {
      var self = this;

      var size = this.fillContainer ?
        { width: el.clientWidth, height: el.clientHeight } :
        { width: this.width,     height: this.height };

      this.stage = new Konva.Stage({
        container: el,
        width:     size.width,
        height:    size.height,
        draggable: this.pannable
      });

      this.layer = new Konva.Layer();
      this.stage.add(this.layer);

      if ( this.fillContainer ) this.observeResize(el);
      if ( this.zoomable )      this.installZoom();

      this.onDetach(function() {
        if ( self.stage ) self.stage.destroy();
      });

      this.onStageReady(this.stage, this.layer);
    },

    function observeResize(el) {
      var self = this;

      var observer = new ResizeObserver(function() {
        if ( ! self.stage ) return;
        // Only the viewport changes; content keeps its stage coordinates.
        self.stage.width(el.clientWidth);
        self.stage.height(el.clientHeight);
        self.stage.batchDraw();
      });

      observer.observe(el);
      this.onDetach(function() { observer.disconnect(); });
    },

    function installZoom() {
      var self  = this;
      var stage = this.stage;

      stage.on('wheel', function(e) {
        e.evt.preventDefault();

        var oldScale = stage.scaleX();
        var pointer  = stage.getPointerPosition();
        if ( ! pointer ) return;

        // Point under the cursor, in stage coordinates, held fixed across
        // the zoom so the canvas scales about the pointer.
        var anchor = {
          x: ( pointer.x - stage.x() ) / oldScale,
          y: ( pointer.y - stage.y() ) / oldScale
        };

        var direction = e.evt.deltaY > 0 ? -1 : 1;
        var newScale  = direction > 0 ?
          oldScale * self.scaleStep :
          oldScale / self.scaleStep;

        newScale = Math.max(self.minScale, Math.min(self.maxScale, newScale));

        stage.scale({ x: newScale, y: newScale });
        stage.position({
          x: pointer.x - anchor.x * newScale,
          y: pointer.y - anchor.y * newScale
        });
        stage.batchDraw();
      });
    },

    function resetView() {
      /** Returns the stage to 1:1 scale at the origin. **/
      if ( ! this.stage ) return;
      this.stage.scale({ x: 1, y: 1 });
      this.stage.position({ x: 0, y: 0 });
      this.stage.batchDraw();
    }
  ]
});
