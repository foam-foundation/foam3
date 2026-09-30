/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.graph',
  name: 'GraphEdgeCView',
  extends: 'foam.graphics.CView',

  documentation: `
    Paints a cubic-bezier connector between two ports, right side of 'from'
    to left side of 'to'. Painted in the same untransformed coordinate space
    as the node/container layer, so x1/y1/x2/y2 track the endpoints' x/y/
    width property changes automatically via expressions -- no manual
    invalidation needed when a node moves.
  `,

  properties: [
    { name: 'from', documentation: 'Source CView (node or container).' },
    { name: 'to',   documentation: 'Target CView (node or container).' },
    { class: 'Int', name: 'fromPortY', value: 18 },
    { class: 'Int', name: 'toPortY',   value: 18 },
    {
      class: 'String',
      name: 'kind',
      documentation: 'One of data|reaction|script; controls the line dash.'
    },
    { class: 'StringArray', name: 'fields', documentation: 'Field names carried by this edge, for the tooltip.' },
    { name: 'theme', documentation: 'A foam.core.reflow.graph.GraphTheme.' },
    { class: 'Boolean', name: 'active' },
    { class: 'Boolean', name: 'selectedEdge' },
    { class: 'Boolean', name: 'dimmed' },
    { class: 'Float', name: 'minOffset', value: 40 },
    {
      class: 'Float',
      name: 'x1',
      expression: function(from$x, from$width) { return ( from$x || 0 ) + ( from$width || 0 ); }
    },
    {
      class: 'Float',
      name: 'y1',
      expression: function(from$y, fromPortY) { return ( from$y || 0 ) + fromPortY; }
    },
    {
      class: 'Float',
      name: 'x2',
      expression: function(to$x) { return to$x || 0; }
    },
    {
      class: 'Float',
      name: 'y2',
      expression: function(to$y, toPortY) { return ( to$y || 0 ) + toPortY; }
    },
    {
      class: 'Float',
      name: 'alpha',
      expression: function(dimmed) { return dimmed ? 0.15 : 1; }
    }
  ],

  methods: [
    function controlPoints() {
      var dx = Math.max(this.minOffset, ( this.x2 - this.x1 ) / 2);
      return [ this.x1 + dx, this.y1, this.x2 - dx, this.y2 ];
    },

    function pointAt(t) {
      var cp = this.controlPoints();
      var mt = 1 - t;
      return {
        x: mt*mt*mt*this.x1 + 3*mt*mt*t*cp[0] + 3*mt*t*t*cp[2] + t*t*t*this.x2,
        y: mt*mt*mt*this.y1 + 3*mt*mt*t*cp[1] + 3*mt*t*t*cp[3] + t*t*t*this.y2
      };
    },

    function paintSelf(ctx) {
      var theme = this.theme;
      var t     = theme ? theme.colors : {};
      var cp    = this.controlPoints();

      var strokeColor = this.selectedEdge ? t.edgeSelected :
                         this.active       ? t.edgeActive :
                         t.edge;
      var dash = this.kind === 'reaction' ? [6, 4] :
                 this.kind === 'script'   ? [2, 3] :
                 [];

      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth   = ( this.selectedEdge || this.active ) ? 3 : 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.bezierCurveTo(cp[0], cp[1], cp[2], cp[3], this.x2, this.y2);
      ctx.stroke();

      // Arrowhead: two fixed 6px lines at +-45 degrees, pointing left into
      // the target port. Always solid, regardless of the edge's own dash.
      var ah = 6;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(this.x2, this.y2);
      ctx.lineTo(this.x2 - ah * Math.cos(Math.PI / 4), this.y2 - ah * Math.sin(Math.PI / 4));
      ctx.moveTo(this.x2, this.y2);
      ctx.lineTo(this.x2 - ah * Math.cos(Math.PI / 4), this.y2 + ah * Math.sin(Math.PI / 4));
      ctx.stroke();
      ctx.restore();
    },

    function hitTest(p) {
      // p arrives in scene units (GraphScene scales it by its zoom first), so
      // the target widens as the scene shrinks: 6 screen px either side.
      var scene = this.parent && this.parent.parent;
      var r     = 6 / ( ( scene && scene.scaleX ) || 1 );
      var r2    = r * r;
      for ( var i = 0 ; i <= 24 ; i++ ) {
        var pt = this.pointAt(i / 24);
        var dx = pt.x - p.x, dy = pt.y - p.y;
        if ( dx*dx + dy*dy <= r2 ) return true;
      }
      return false;
    },

    function tooltipAt() {
      return ( this.fields && this.fields.length ) ? this.fields.join(', ') : null;
    }
  ]
});
