/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// =============================================================================
// FSMDiagramView - Renders a state machine as an SVG diagram
// =============================================================================

foam.CLASS({
  package: 'foam.u2.view',
  name: 'FSMDiagramView',
  extends: 'foam.u2.Controller',

  documentation: 'Renders a StateMachineEnum as an SVG diagram with simulated annealing layout.',

  properties: [
    {
      class: 'Class',
      name: 'of',
      hidden: true,
      documentation: 'The StateMachineEnum class to render.'
    },
    {
      name: 'data',
      hidden: true,
      documentation: 'Optional object with a state property to highlight current state.'
    },
    {
      class: 'String',
      name: 'stateProp',
      hidden: true,
      documentation: 'Name of the state property on data object.',
      value: 'status'
    },
    {
      class: 'Int',
      name: 'width',
      value: 1600
    },
    {
      class: 'Int',
      name: 'height',
      value: 800
    },
    {
      class: 'Int',
      name: 'nodeWidth',
      value: 400
    },
    {
      class: 'Int',
      name: 'nodeHeight',
      value: 100
    },
    {
      class: 'Int',
      name: 'padding',
      value: 40
    },
    {
      class: 'Int',
      name: 'iterations',
      value: 1000,
      documentation: 'Number of simulated annealing iterations.'
    },
    {
      class: 'Float',
      name: 'coolingRate',
      value: 0.99999,
      documentation: 'Cooling rate for simulated annealing.'
    },
    {
      class: 'Boolean',
      name: 'cartesianDistance',
      documentation: 'If true then use cartesian distances, otherwise use Manhattan distance.',
      value: true
    },
    {
      class: 'Float',
      name: 'currentEnergy_',
      visibility: 'RO',
      documentation: 'Current energy level of the layout.'
    },

    { class: 'Float', name: 'edgeLengthWeight',      value: 1    },
    { class: 'Float', name: 'edgeCrossingWeight',    value: 1000 },
    { class: 'Float', name: 'edgeNodeOverlapWeight', value: 1000 },
    { class: 'Float', name: 'nodeOverlapWeight',     value: 1000 },
    { class: 'Float', name: 'nodeRepulsionWeight',   value: 1000 },
    { class: 'Float', name: 'leftToRightWeight',     value: 1000 },
    { class: 'Float', name: 'diagonalEdgeWeight',    value: 1000 },
    { class: 'Float', name: 'customWeight',          value: 1000 },

    { class: 'Int', name: 'edgeLengthEnergy',      precision: 0, visibility: 'RO' },
    { class: 'Int', name: 'edgeCrossingEnergy',    precision: 0, visibility: 'RO' },
    { class: 'Int', name: 'edgeNodeOverlapEnergy', precision: 0, visibility: 'RO' },
    { class: 'Int', name: 'nodeOverlapEnergy',     precision: 0, visibility: 'RO' },
    { class: 'Int', name: 'nodeRepulsionEnergy',   precision: 0, visibility: 'RO' },
    { class: 'Int', name: 'leftToRightEnergy',     precision: 0, visibility: 'RO' },
    { class: 'Int', name: 'diagonalEdgeEnergy',    precision: 0, visibility: 'RO' },
    { class: 'Int', name: 'customEnergy',          precision: 0, visibility: 'RO' },

    {
      name: 'positions_',
      hidden: true,
      factory: function() { return {}; }
    },
    {
      name: 'states_',
      hidden: true,
      documentation: 'Cached states array.'
    },
    {
      name: 'edges_',
      hidden: true,
      documentation: 'Cached edges array.'
    },
    {
      name: 'svgContainer_',
      hidden: true,
      documentation: 'Reference to the SVG container element.'
    },
    {
      class: 'Float',
      name: 'initialTemp',
      value: 100,
      documentation: 'Initial temperature for simulated annealing.'
    },
    {
      class: 'Float',
      name: 'currentTemp_',
      documentation: 'Current temperature for continued annealing.',
      factory: function() { return this.initialTemp; }
    },
    {
      class: 'Boolean',
      name: 'animate',
      value: true
    }
  ],

  methods: [
    function render() {
      this.SUPER();

      let self = this;

      if ( ! this.of ) {
        this.add('No state machine specified');
        return;
      }

      this.tag(foam.u2.DetailView, {data: this});

      this.states_ = this.of.VALUES;
      this.buildEdges_();
      this.initializeLayeredPositions_(this.states_);
      this.currentTemp_ = this.initialTemp;
      this.simulatedAnnealing_(this.states_, this.edges_);

      this
        .start('div')
          .style({ 'margin-bottom': '10px' })
          .start('button')
            .add('Improve Layout')
            .on('click', this.onStartLayout)
          .end()
        .end()
        .start('div', null, this.svgContainer_$)
          .call(function() { self.renderSVG_(this); })
        .end();
    },

    function renderSVG_(container) {
      let self = this;

      container
        .start('svg')
          .attrs({
            width: this.width,
            height: this.height,
            viewBox: `0 0 ${this.width} ${this.height}`
          })
          .start('defs')
            .start('marker')
              .attrs({
                id: this.id + '-arrowhead',
                markerWidth: 10,
                markerHeight: 7,
                refX: 9,
                refY: 3.5,
                orient: 'auto'
              })
              .start('polygon')
                .attrs({
                  points: '0 0, 10 3.5, 0 7',
                  fill: '#666'
                })
              .end()
            .end()
          .end()
          .call(function() { self.renderNodes(this, self.states_); })
          .call(function() { self.renderTransitions(this, self.states_); })
        .end();
    },

    function buildEdges_() {
      var self = this;
      this.edges_ = [];
      var stateNames = this.states_.map(s => s.name);

      this.states_.forEach(function(state) {
        state.transitions.forEach(function(targetName) {
          if ( stateNames.includes(targetName) ) {
            self.edges_.push([state.name, targetName]);
          }
        });
      });
    },

    function initializeLayeredPositions_(states) {
      var self     = this;
      var initial  = states.filter(s => s.isInitial);
      var terminal = states.filter(s => s.isTerminal);
      var middle   = states.filter(s => ! s.isInitial && ! s.isTerminal);

      var layers = [initial, middle, terminal].filter(l => l.length > 0);
      var layerWidth = (this.width - this.padding * 2 - this.nodeWidth) / Math.max(layers.length - 1, 1);

      layers.forEach(function(layer, layerIndex) {
        var layerHeight = (self.height - self.padding * 2 - self.nodeHeight) / Math.max(layer.length - 1, 1);
        layer.forEach(function(state, stateIndex) {
          self.positions_[state.name] = {
            x: self.padding + self.nodeWidth / 2 + layerWidth * layerIndex,
            y: self.padding + self.nodeHeight / 2 + (layer.length > 1 ? layerHeight * stateIndex : (self.height - self.padding * 2) / 2)
          };
        });
      });
    },

    function simulatedAnnealing_(states, edges) {
      var self = this;
      var temp = this.currentTemp_;
      var minX = this.padding + this.nodeWidth / 2;
      var maxX = this.width - this.padding - this.nodeWidth / 2;
      var minY = this.padding + this.nodeHeight / 2;
      var maxY = this.height - this.padding - this.nodeHeight / 2;

      this.anneal(states, edges, 100);

      for ( var i = 0 ; i < this.iterations ; i++ ) {
        var state = states[Math.floor(Math.random() * states.length)];
        var pos   = this.positions_[state.name];
        var oldX  = pos.x;
        var oldY  = pos.y;

        var moveScale = temp / 100;
        var dx = (Math.random() - 0.5) * 2 * moveScale * this.width;
        var dy = (Math.random() - 0.5) * 2 * moveScale * this.height;

        pos.x = Math.max(minX, Math.min(maxX, pos.x + dx));
        pos.y = Math.max(minY, Math.min(maxY, pos.y + dy));

        if ( pos.x === oldX && pos.y === oldY ) continue;

        if ( ! this.anneal(states, edges, temp) ) {
          pos.x = oldX;
          pos.y = oldY;
        }

        temp *= this.coolingRate;
      }

      this.currentTemp_ = temp;
    },

    function anneal(states, edges, temp) {
      function interp(s1, e1, s2, e2, v) {
        if ( v < s1 ) return s2;
        if ( v > e1 ) return e2;
        var p = (v - s1) / (e1 - s1);
        return s2 + p * (e2 - s2);
      }

      let self                  = this;

      let edgeLengthWeight      = this.edgeLengthWeight;
      let edgeCrossingWeight    = this.edgeCrossingWeight;
      let edgeNodeOverlapWeight = this.edgeNodeOverlapWeight;
      let nodeOverlapWeight     = this.nodeOverlapWeight;
      let nodeRepulsionWeight   = this.nodeRepulsionWeight;
      let leftToRightWeight     = this.leftToRightWeight;
      let diagonalEdgeWeight    = this.diagonalEdgeWeight;
      let customWeight          = this.customWeight;

      let edgeLengthEnergy      = 0;
      let edgeCrossingEnergy    = 0;
      let edgeNodeOverlapEnergy = 0;
      let nodeOverlapEnergy     = 0;
      let nodeRepulsionEnergy   = 0;
      let leftToRightEnergy     = 0;
      let diagonalEdgeEnergy    = 0;
      let customEnergy          = 0;

      // Edge lengths
      if ( edgeLengthWeight ) edges.forEach(function(edge) {
        var from = self.positions_[edge[0]];
        var to   = self.positions_[edge[1]];
        // Euclidian Distance
        var dist = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        // Manhattan Distance
        // var dist = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
        dist = dist;
        edgeLengthEnergy += edgeLengthWeight * dist;
      });

      // Edge crossings
      if ( edgeCrossingWeight ) for ( var i = 0; i < edges.length; i++ ) {
        for ( var j = i + 1; j < edges.length; j++ ) {
          if ( self.edgesIntersect_(edges[i], edges[j]) ) {
            edgeCrossingEnergy += edgeCrossingWeight;
          }
        }
      }

      // Node overlaps and distances between
      if ( nodeOverlapWeight || nodeRepulsionWeight ) {
        for ( var i = 0 ; i < states.length ; i++ ) {
          var posA = self.positions_[states[i].name];

          for ( var j = i + 1 ; j < states.length ; j++ ) {
            var posB = self.positions_[states[j].name];

            var dx = Math.abs(posA.x - posB.x);
            var dy = Math.abs(posA.y - posB.y);

            if ( nodeOverlapWeight && dx < self.nodeWidth && dy < self.nodeHeight ) {
              var overlapX = self.nodeWidth  - dx;
              var overlapY = self.nodeHeight - dy;
              nodeOverlapEnergy += nodeOverlapWeight * (overlapX + overlapY);
            }

            if ( nodeRepulsionWeight ) {
              var dist = dx + dy; // Math.sqrt(dx * dx + dy * dy);
              nodeRepulsionEnergy += nodeRepulsionWeight * Math.pow(interp(0, 1000, 1, 0, dist), 2);

              // Allow objects to implement custom layout concerns
              if ( states[i].calculateGraphEnergy ) customEnergy += customWeight * states[i].calculateGraphEnergy(states[j], dist);
            }
          }
        }
      }

      // Edge-node overlaps (edges passing through nodes they don't connect to)
      if ( edgeNodeOverlapWeight ) edges.forEach(function(edge) {
        var fromPos = self.positions_[edge[0]];
        var toPos   = self.positions_[edge[1]];

        states.forEach(function(state) {
          // Skip if this node is an endpoint of the edge
          if ( state.name === edge[0] || state.name === edge[1] ) return;

          var nodePos = self.positions_[state.name];
          if ( self.edgeIntersectsNode_(fromPos, toPos, nodePos) ) {
            edgeNodeOverlapEnergy += edgeNodeOverlapWeight;
          }
        });
      });

      // Diagonal edge penalty - prefer horizontal or vertical edges
      // Maximum penalty at 45 degrees, zero at 0 or 90 degrees
      if ( diagonalEdgeWeight ) edges.forEach(function(edge) {
        var from = self.positions_[edge[0]];
        var to   = self.positions_[edge[1]];
        var dx   = Math.abs(to.x - from.x);
        var dy   = Math.abs(to.y - from.y);

        if ( dx > 0 && dy > 0 ) {
          // Cheaper function than sin(2*atan2(dy,dx)) that does approximately the same
          // Returns 0 for horizontal/vertical, 1 for 45°
          diagonalEdgeEnergy += diagonalEdgeWeight * (( dx < dy ) ? dx/dy : dy/dx);
        }
      });

      // Left to Right bias
      if ( leftToRightWeight ) edges.forEach(function(edge) {
        var from = self.positions_[edge[0]];
        var to   = self.positions_[edge[1]];
        if ( to.x < from.x ) {
          leftToRightEnergy += leftToRightWeight * (from.x - to.x);
        }
      });

      /*
      // Initial states on left and Terminal states on the right
      states.forEach(function(state) {
        if ( state.isInitial ) {
          diagonalEdgeEnergy += self.positions_[state.name].x * 0.5;
        }
        if ( state.isTerminal ) {
          diagonalEdgeEnergy += (self.width - self.positions_[state.name].x) * 0.5;
        }
        });
      */

      let newEnergy =
          edgeLengthEnergy      +
          edgeCrossingEnergy    +
          edgeNodeOverlapEnergy +
          nodeOverlapEnergy     +
          nodeRepulsionEnergy   +
          leftToRightEnergy     +
          diagonalEdgeEnergy    +
          customEnergy          ;

      let delta = (newEnergy - this.currentEnergy_) / this.currentEnergy_;
      let keep  = temp === 100 || delta < 0 || Math.random() < temp / 100 * (1-delta);

      if ( ! keep ) return false;

      this.edgeLengthEnergy      = edgeLengthEnergy;
      this.edgeCrossingEnergy    = edgeCrossingEnergy;
      this.edgeNodeOverlapEnergy = edgeNodeOverlapEnergy;
      this.nodeOverlapEnergy     = nodeOverlapEnergy;
      this.nodeRepulsionEnergy   = nodeRepulsionEnergy;
      this.diagonalEdgeEnergy    = diagonalEdgeEnergy;
      this.customEnergy          = customEnergy;
      this.currentEnergy_        = newEnergy;

      return true;
    },

    function edgeIntersectsNode_(fromPos, toPos, nodePos) {
      // Check if the line segment from fromPos to toPos intersects the node rectangle
      // Node rectangle is centered at nodePos with dimensions nodeWidth x nodeHeight

      var halfW = this.nodeWidth  / 2 + 10;   // Add padding
      var halfH = this.nodeHeight / 2 + 10;

      var nodeLeft   = nodePos.x - halfW;
      var nodeRight  = nodePos.x + halfW;
      var nodeTop    = nodePos.y - halfH;
      var nodeBottom = nodePos.y + halfH;

      // Check if line segment intersects any of the four edges of the rectangle
      return this.lineSegmentsIntersect_(fromPos.x, fromPos.y, toPos.x, toPos.y, nodeLeft, nodeTop, nodeRight, nodeTop) ||      // Top edge
             this.lineSegmentsIntersect_(fromPos.x, fromPos.y, toPos.x, toPos.y, nodeLeft, nodeBottom, nodeRight, nodeBottom) || // Bottom edge
             this.lineSegmentsIntersect_(fromPos.x, fromPos.y, toPos.x, toPos.y, nodeLeft, nodeTop, nodeLeft, nodeBottom) ||     // Left edge
             this.lineSegmentsIntersect_(fromPos.x, fromPos.y, toPos.x, toPos.y, nodeRight, nodeTop, nodeRight, nodeBottom);     // Right edge
    },

    function edgesIntersect_(edge1, edge2) {
      if ( edge1[0] === edge2[0] || edge1[0] === edge2[1] || edge1[1] === edge2[0] || edge1[1] === edge2[1] ) {
        return false;
      }

      var p1 = this.positions_[edge1[0]];
      var p2 = this.positions_[edge1[1]];
      var p3 = this.positions_[edge2[0]];
      var p4 = this.positions_[edge2[1]];

      return this.lineSegmentsIntersect_(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y);
    },

    function lineSegmentsIntersect_(x1, y1, x2, y2, x3, y3, x4, y4) {
      var denom = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
      if ( denom === 0 ) return false;

      var ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denom;
      var ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denom;

      return ua > 0 && ua < 1 && ub > 0 && ub < 1;
    },

    function renderNodes(svg, states) {
      let self = this;
      var currentState = this.data && this.data[this.stateProp];

      states.forEach(function(state) {
        var pos = self.positions_[state.name];
        var isCurrent = currentState && currentState.name === state.name;

        svg
          .start('g')
            .attrs({ transform: `translate(${pos.x}, ${pos.y})` })
            .callIf(state.isTerminal, function() {
              this.start('rect')
                .attrs({
                  x: -self.nodeWidth / 2 - 4,
                  y: -self.nodeHeight / 2 - 4,
                  width: self.nodeWidth + 8,
                  height: self.nodeHeight + 8,
                  rx: 12,
                  ry: 12,
                  fill: 'none',
                  stroke: state.color || '#666',
                  'stroke-width': 2
                })
              .end();
            })
            .start('rect')
              .attrs({
                x: -self.nodeWidth / 2,
                y: -self.nodeHeight / 2,
                width: self.nodeWidth,
                height: self.nodeHeight,
                rx: 8,
                ry: 8,
                fill: isCurrent ? (state.background || '#e3f2fd') : (state.background || '#fff'),
                stroke: state.color || '#666',
                'stroke-width': state.isInitial ? 4 : (isCurrent ? 4 : 1)
              })
            .end()
            .start('text')
              .attrs({
                x: 0,
                y: 0,
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                'font-family': 'sans-serif',
                'font-size': '10px',
                'font-weight': isCurrent ? 'bold' : 'normal',
                fill: state.color || '#333'
              })
              .add(state.name)
            .end()
            .callIf(state.isInitial, function() {
              this.start('circle')
                .attrs({
                  cx: -self.nodeWidth / 2 - 20,
                  cy: 0,
                  r: 6,
                  fill: state.color || '#666'
                })
              .end()
              .start('line')
                .attrs({
                  x1: -self.nodeWidth / 2 - 14,
                  y1: 0,
                  x2: -self.nodeWidth / 2,
                  y2: 0,
                  stroke: state.color || '#666',
                  'stroke-width': 2,
                  'marker-end': `url(#${self.id}-arrowhead)`
                })
              .end();
            })
          .end();
      });
    },

    function renderTransitions(svg, states) {
      var self = this;
      var drawnPairs = {};

      states.forEach(function(state) {
        var fromPos = self.positions_[state.name];

        state.transitions.forEach(function(targetName) {
          var toPos = self.positions_[targetName];
          if ( ! toPos ) return;

          var pairKey = [state.name, targetName].sort().join('-');
          var isReverse = drawnPairs[pairKey];
          drawnPairs[pairKey] = true;

          self.renderArrow_(svg, fromPos, toPos, isReverse);
        });
      });
    },

    function renderArrow_(svg, from, to, offset) {
      var dx = to.x - from.x;
      var dy = to.y - from.y;
      var len = Math.sqrt(dx * dx + dy * dy);

      if ( len === 0 ) return;

      var nx = dx / len;
      var ny = dy / len;

      var startX = from.x + nx * (this.nodeWidth / 2 + 5);
      var startY = from.y + ny * (this.nodeHeight / 2 + 5);
      var endX   = to.x - nx * (this.nodeWidth / 2 + 15);
      var endY   = to.y - ny * (this.nodeHeight / 2 + 15);

      var offsetAmt = offset ? 15 : 0;
      var perpX = -ny * offsetAmt;
      var perpY = nx * offsetAmt;

      var midX = (startX + endX) / 2 + perpX;
      var midY = (startY + endY) / 2 + perpY;

      var curveX = perpX * 2;
      var curveY = perpY * 2;

      svg
        .start('path')
          .attrs({
            d: offset
              ? `M ${startX + perpX} ${startY + perpY} Q ${midX + curveX} ${midY + curveY} ${endX + perpX} ${endY + perpY}`
              : `M ${startX} ${startY} L ${endX} ${endY}`,
            fill: 'none',
            stroke: '#666',
            'stroke-width': 1.5,
            'marker-end': `url(#${this.id}-arrowhead)`
          })
        .end();
    }
  ],

  listeners: [
    function onStartLayout() {
      this.currentTemp_ = this.initialTemp;
      this.onImproveLayout();
    },
    {
      name: 'onImproveLayout',
      isFramed: true,
      code: function() {
        // Run more iterations of simulated annealing
        this.simulatedAnnealing_(this.states_, this.edges_);

        // Clear and re-render the SVG
        this.svgContainer_.removeAllChildren();
        this.renderSVG_(this.svgContainer_);

        if ( this.animate && this.currentTemp_ > 0.1 ) this.onImproveLayout();
      }
    }
  ]
});
