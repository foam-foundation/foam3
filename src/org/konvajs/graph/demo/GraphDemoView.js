/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs.graph.demo',
  name: 'GraphDemoView',
  extends: 'foam.u2.View',

  documentation: `Acceptance demo for the graph primitives: a seeded concept
    map with every edge style and node state, one deliberately dangling
    edge, and mutation buttons. Node-removal cascade (incident edges out of
    the edgeDAO first) lives here - it is app policy, not DiagramView's.`,

  requires: [
    'foam.dao.EasyDAO',
    'foam.u2.detail.SectionedDetailView',
    'org.konvajs.graph.GraphNode',
    'org.konvajs.graph.GraphEdge',
    'org.konvajs.graph.view.DiagramView'
  ],

  css: `
    ^ { display: flex; height: 100%; }
    ^sidebar {
      width: 280px;
      border-right: 1px solid $borderLight;
      padding: 12px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    ^canvas { flex: 1; overflow: hidden; }
    ^hint { font-size: 11px; color: $textSecondary; margin: 8px 0; }
  `,

  properties: [
    {
      name: 'nodeDAO',
      factory: function() {
        var dao = this.EasyDAO.create({ of: 'org.konvajs.graph.GraphNode', daoType: 'MDAO' });
        var N = this.GraphNode;
        var states = [ 'normal', 'highlighted', 'processing', 'pseudo', 'temp', 'collapsed' ];

        for ( var i = 0 ; i < 15 ; i++ ) {
          dao.put(N.create({
            id: 'n' + i,
            label: 'Concept ' + i,
            state: i < states.length ? states[i] : 'normal',
            color: i % 3 === 0 ? '#e74c3c' : '#3498db'
          }));
        }
        return dao;
      }
    },
    {
      name: 'edgeDAO',
      factory: function() {
        var dao = this.EasyDAO.create({ of: 'org.konvajs.graph.GraphEdge', daoType: 'MDAO' });
        var E = this.GraphEdge;
        var styles = [ 'arrow', 'plain', 'dash' ];

        for ( var i = 1 ; i < 15 ; i++ ) {
          dao.put(E.create({
            id: 'e' + i,
            label: i % 4 === 0 ? 'relates to' : '',
            sourceId: 'n' + Math.floor((i - 1) / 2),
            targetId: 'n' + i,
            style: styles[i % 3]
          }));
        }
        // Extra cross-links for a denser graph.
        dao.put(E.create({ id: 'x1', sourceId: 'n2', targetId: 'n9',  style: 'dash',  label: 'informs' }));
        dao.put(E.create({ id: 'x2', sourceId: 'n4', targetId: 'n11', style: 'plain' }));
        dao.put(E.create({ id: 'x3', sourceId: 'n1', targetId: 'n14', style: 'arrow', label: 'drives' }));
        dao.put(E.create({ id: 'x4', sourceId: 'n6', targetId: 'n13', style: 'arrow' }));
        dao.put(E.create({ id: 'x5', sourceId: 'n3', targetId: 'n10', style: 'plain' }));
        // Deliberately dangling: proves the warn-once path.
        dao.put(E.create({ id: 'dangling', sourceId: 'n0', targetId: 'missing' }));
        return dao;
      }
    },
    { name: 'diagram' }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this.addClass()
        .start().addClass(this.myClass('sidebar'))
          .start('h3').add('Graph Demo').end()
          .start(this.ADD_NODE).end()
          .start(this.ADD_EDGE).end()
          .start(this.REMOVE_SELECTED).end()
          .start(this.ALIGN_NODES).end()
          .start(this.FIT_VIEW).end()
          .start('p').addClass(this.myClass('hint'))
            .add('Scroll to zoom, drag empty canvas to pan, drag nodes to pin them.')
          .end()
          .add(this.slot(function(diagram) {
            if ( ! diagram ) return this.E();
            return this.E().add(diagram.slot(function(selected) {
              if ( ! selected ) {
                return this.E('p').addClass(self.myClass('hint'))
                  .add('Click a node or edge to select it.');
              }
              return this.E().tag(self.SectionedDetailView, { data$: diagram.selected$ });
            }));
          }))
        .end()
        .start().addClass(this.myClass('canvas'))
          .tag(this.DiagramView, {
            nodeDAO: this.nodeDAO,
            edgeDAO: this.edgeDAO
          }, this.diagram$)
        .end();
    }
  ],

  actions: [
    {
      name: 'addNode',
      label: 'Add Node',
      code: function() {
        var self = this;
        var n = this.GraphNode.create({ label: 'New ' + Math.floor(Math.random() * 100) });
        this.nodeDAO.put(n).then(function() {
          self.nodeDAO.select().then(function(sink) {
            var others = sink.array.filter(o => o.id !== n.id);
            if ( ! others.length ) return;
            var target = others[Math.floor(Math.random() * others.length)];
            self.edgeDAO.put(self.GraphEdge.create({ sourceId: target.id, targetId: n.id }));
          });
        });
      }
    },
    {
      name: 'addEdge',
      label: 'Add Edge',
      code: function() {
        var self = this;
        this.nodeDAO.select().then(function(sink) {
          var a = sink.array;
          if ( a.length < 2 ) return;
          var i = Math.floor(Math.random() * a.length);
          var j = (i + 1 + Math.floor(Math.random() * (a.length - 1))) % a.length;
          self.edgeDAO.put(self.GraphEdge.create({
            sourceId: a[i].id, targetId: a[j].id, style: 'arrow'
          }));
        });
      }
    },
    {
      name: 'removeSelected',
      label: 'Remove Selected',
      code: function() {
        var self = this;
        var sel  = this.diagram && this.diagram.selected;
        if ( ! sel ) return;
        if ( this.GraphEdge.isInstance(sel) ) {
          this.edgeDAO.remove(sel);
          return;
        }
        // Node: cascade incident edges first (app policy).
        this.edgeDAO.select().then(function(sink) {
          var incident = sink.array.filter(
            e => e.sourceId === sel.id || e.targetId === sel.id);
          Promise.all(incident.map(e => self.edgeDAO.remove(e)))
            .then(function() { self.nodeDAO.remove(sel); });
        });
      }
    },
    {
      name: 'alignNodes',
      label: 'Align Nodes',
      code: function() {
        var self = this;
        // Align unpins everything, then relayouts (Graphologue semantics).
        this.nodeDAO.select().then(function(sink) {
          sink.array.forEach(n => { n.pinned = false; });
          self.diagram.runLayout();
        });
      }
    },
    {
      name: 'fitView',
      label: 'Fit View',
      code: function() { this.diagram.fitView(); }
    }
  ]
});
