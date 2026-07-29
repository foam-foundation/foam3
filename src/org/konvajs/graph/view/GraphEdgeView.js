/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs.graph.view',
  name: 'GraphEdgeView',

  documentation: `One GraphEdge as Konva shapes: an Arrow (style 'arrow') or
    Line ('plain'/'dash') plus an optional midpoint label. Geometry comes
    from data.points when a layouter supplied a polyline, else a straight
    segment between the two node-rect border intersection points. The view
    never touches DAOs - the coordinator resolves endpoints and calls
    updateEdge().`,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'org.konvajs.graph.GraphEdge',
      name: 'data',
      postSet: function() {
        this.listenToData();
        this.refresh_();
      }
    },
    { class: 'Simple', name: 'dataSub_' },
    { class: 'Simple', name: 'group' },
    { class: 'Simple', name: 'line_' },
    { class: 'Simple', name: 'label_' },
    {
      class: 'Function',
      name: 'onSelected',
      value: function(data) { }
    }
  ],

  methods: [
    function rectBorderPoint(cx, cy, w, h, tx, ty) {
      /** Point on the border of the w×h rect centered at (cx,cy), on the
          ray from the center toward (tx,ty). Pure function. **/
      var dx = tx - cx, dy = ty - cy;
      if ( dx === 0 && dy === 0 ) return { x: cx, y: cy };
      var sx = dx === 0 ? Infinity : (w / 2) / Math.abs(dx);
      var sy = dy === 0 ? Infinity : (h / 2) / Math.abs(dy);
      var s  = Math.min(sx, sy);
      return { x: cx + dx * s, y: cy + dy * s };
    },

    function createEdge() {
      var self = this;
      var data = this.data;

      this.group = new Konva.Group();

      var cfg = {
        points: [ 0, 0, 0, 0 ],
        stroke: '#888',
        strokeWidth: 1.5,
        hitStrokeWidth: 10,
        lineCap: 'round',
        lineJoin: 'round'
      };

      if ( data.style === 'arrow' ) {
        cfg.fill = '#888';
        cfg.pointerLength = 8;
        cfg.pointerWidth = 8;
        this.line_ = new Konva.Arrow(cfg);
      } else {
        if ( data.style === 'dash' ) cfg.dash = [ 4, 4 ];
        this.line_ = new Konva.Line(cfg);
      }

      this.label_ = new Konva.Text({
        text: data.label || '',
        fontSize: 11,
        fill: '#666',
        visible: !! data.label
      });

      this.group.add(this.line_);
      this.group.add(this.label_);

      this.group.on('click tap', function() { self.onSelected(self.data); });

      this.listenToData();
      this.onDetach(function() {
        if ( self.dataSub_ ) self.dataSub_.detach();
      });

      this.applyState();
      return this.group;
    },

    function listenToData() {
      var self = this;
      if ( this.dataSub_ ) { this.dataSub_.detach(); this.dataSub_ = null; }
      if ( ! this.data ) return;
      this.dataSub_ = this.data.propertyChange.sub(function() {
        self.refresh_();
      });
    },

    function refresh_() {
      if ( ! this.line_ ) return;
      this.applyState();
      this.label_.text(this.data.label || '');
      this.label_.visible(!! this.data.label);
      var layer = this.group && this.group.getLayer();
      if ( layer ) layer.batchDraw();
    },

    function updateEdge(srcRect, tgtRect) {
      if ( ! this.group ) return;

      var pts = this.data.points;
      if ( ! pts || pts.length < 4 ) {
        var scx = srcRect.x + srcRect.width  / 2,
            scy = srcRect.y + srcRect.height / 2,
            tcx = tgtRect.x + tgtRect.width  / 2,
            tcy = tgtRect.y + tgtRect.height / 2;
        var p1 = this.rectBorderPoint(scx, scy, srcRect.width, srcRect.height, tcx, tcy);
        var p2 = this.rectBorderPoint(tcx, tcy, tgtRect.width, tgtRect.height, scx, scy);
        pts = [ p1.x, p1.y, p2.x, p2.y ];
      }

      this.line_.points(pts);

      // Label at the midpoint between first and last vertex.
      var lx = ( pts[0] + pts[pts.length - 2] ) / 2;
      var ly = ( pts[1] + pts[pts.length - 1] ) / 2;
      this.label_.position({ x: lx + 4, y: ly - 14 });
      this.label_.text(this.data.label || '');
      this.label_.visible(!! this.data.label);
    },

    function applyState() {
      if ( ! this.line_ ) return;
      var hi = this.data.state === 'highlighted';
      this.line_.stroke(hi ? '#0b57d0' : '#888');
      this.line_.strokeWidth(hi ? 3 : 1.5);
      if ( this.line_.fill ) this.line_.fill(hi ? '#0b57d0' : '#888');
      var layer = this.group && this.group.getLayer();
      if ( layer ) layer.batchDraw();
    },

    function removeEdge() {
      if ( this.group ) {
        this.group.destroy();
        this.group = null;
      }
    }
  ]
});
