/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs.graph.view',
  name: 'GraphNodeView',

  documentation: `One GraphNode as a draggable Konva group. The base class
    owns the lifecycle: createNode() builds the group once, wires
    click/drag events, subscribes to the model, and delegates shape
    construction to buildShapes(); updateNode() reconciles position in
    place and delegates the rest to reconcileShapes().

    Subclass contract: override buildShapes(group) to create and add your
    own shapes, reconcileShapes() to reconcile them with 'data', and
    optionally applyState(). Never override createNode()/updateNode() -
    they carry the lifecycle every node view relies on.

    Default shapes: rect + centered label. States: normal, highlighted
    (brand stroke), processing (pulsing opacity), pseudo (grey,
    strokeless), temp (dashed stroke, '...' label), collapsed (count
    badge).`,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'org.konvajs.graph.GraphNode',
      name: 'data',
      postSet: function() {
        this.listenToData();
        this.updateNode();
      }
    },
    { class: 'Simple', name: 'dataSub_' },
    { class: 'Simple', name: 'group' },
    { class: 'Simple', name: 'rect_' },
    { class: 'Simple', name: 'text_' },
    { class: 'Simple', name: 'badge_' },
    { class: 'Simple', name: 'pulse_' },
    { class: 'Int',    name: 'collapsedCount' },
    { class: 'Function', name: 'onSelected', value: function(data) { } },
    { class: 'Function', name: 'onMoved',    value: function(data) { } },
    { class: 'Function', name: 'onDragMove', value: function(id, x, y) { } }
  ],

  methods: [
    function createNode() {
      var self = this;
      var data = this.data;

      var group = new Konva.Group({
        x: data.x,
        y: data.y,
        draggable: true,
        id: data.id
      });
      this.group = group;

      this.buildShapes(group);

      group.on('click tap', function() { self.onSelected(self.data); });

      group.on('dragmove', function() {
        self.onDragMove(self.data.id, group.x(), group.y());
      });

      group.on('dragend', function() {
        self.data.x = group.x();
        self.data.y = group.y();
        self.data.pinned = true;
        self.onMoved(self.data);
      });

      this.listenToData();
      this.onDetach(function() {
        if ( self.dataSub_ ) self.dataSub_.detach();
        self.stopPulse();
      });

      this.reconcileShapes();
      return group;
    },

    function buildShapes(group) {
      /** Build the node's Konva shapes and add them to the group. Called
          once from createNode(). Default: rect + centered label +
          collapsed badge. Subclasses build their own shapes here; the
          base reconcileShapes()/applyState() no-op safely when rect_ is
          absent. **/
      var data = this.data;

      this.rect_ = new Konva.Rect({
        width: data.width,
        height: data.height,
        fill: data.color,
        stroke: '#333',
        strokeWidth: 1,
        cornerRadius: 6
      });

      this.text_ = new Konva.Text({
        text: data.label,
        fontSize: 13,
        fill: 'white',
        width: data.width,
        height: data.height,
        align: 'center',
        verticalAlign: 'middle',
        padding: 6,
        listening: false
      });

      this.badge_ = new Konva.Text({
        text: '',
        fontSize: 10,
        fill: '#333',
        x: data.width - 18,
        y: -14,
        visible: false,
        listening: false
      });

      group.add(this.rect_);
      group.add(this.text_);
      group.add(this.badge_);
    },

    function listenToData() {
      var self = this;
      if ( this.dataSub_ ) { this.dataSub_.detach(); this.dataSub_ = null; }
      if ( ! this.data ) return;
      this.dataSub_ = this.data.propertyChange.sub(function() {
        self.updateNode();
      });
    },

    function updateNode() {
      if ( ! this.group ) return;

      this.group.position({ x: this.data.x, y: this.data.y });
      this.reconcileShapes();

      var layer = this.group.getLayer();
      if ( layer ) layer.batchDraw();
    },

    function reconcileShapes() {
      /** Reconcile the shapes built by buildShapes() with 'data'. Called
          from createNode() and every updateNode(). **/
      if ( ! this.rect_ ) return;
      var data = this.data;

      this.rect_.width(data.width);
      this.rect_.height(data.height);
      this.text_.width(data.width);
      this.text_.height(data.height);
      this.badge_.x(data.width - 18);
      this.applyState();
    },

    function applyState() {
      if ( ! this.rect_ ) return;
      var data = this.data;

      // Reset to the model's base look, then overlay state.
      this.rect_.fill(data.color);
      this.rect_.stroke('#333');
      this.rect_.strokeWidth(1);
      this.rect_.dash([]);
      this.text_.text(data.label);
      this.text_.fill('white');
      this.badge_.visible(false);
      this.group && this.group.opacity(1);
      this.stopPulse();

      switch ( data.state ) {
        case 'highlighted':
          this.rect_.stroke('#0b57d0');
          this.rect_.strokeWidth(3);
          break;
        case 'processing':
          this.startPulse();
          break;
        case 'pseudo':
          this.rect_.fill('#bdc3c7');
          this.rect_.strokeWidth(0);
          this.text_.fill('#333');
          break;
        case 'temp':
          this.rect_.fill('white');
          this.rect_.dash([ 4, 4 ]);
          this.text_.fill('#999');
          this.text_.text('...');
          break;
        case 'collapsed':
          this.badge_.text('+' + this.collapsedCount);
          this.badge_.visible(true);
          break;
      }
    },

    function startPulse() {
      var self = this;
      var layer = this.group && this.group.getLayer();
      if ( ! layer || this.pulse_ ) return;
      this.pulse_ = new Konva.Animation(function(frame) {
        self.group.opacity(0.65 + 0.35 * Math.abs(Math.sin(frame.time / 400)));
      }, layer);
      this.pulse_.start();
    },

    function stopPulse() {
      if ( this.pulse_ ) {
        this.pulse_.stop();
        this.pulse_ = null;
        if ( this.group ) this.group.opacity(1);
      }
    },

    function removeNode() {
      this.stopPulse();
      if ( this.group ) {
        this.group.destroy();
        this.group = null;
      }
    }
  ]
});
