/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.ooux.view',
    name: 'OOUXBoardView',
    extends: 'foam.u2.View',

    documentation: `An OOUX board: a DiagramView projection of two DAOs
      (objects, relationships) plus board policy - seeding, Add Object,
      Transformer resize, two-click Connect, Align Cards, and the sidebar
      editor. All canvas coordination (reconcile, edge routing, selection,
      layout) lives in DiagramView; cards render through CardNode via
      nodeViewClass.

      DiagramView's 'selected' can be an OOUXObject, an OOUXRelationship,
      or null - every consumer here guards with OOUXObject.isInstance.`,

    requires: [
        'foam.dao.EasyDAO',
        'foam.u2.detail.SectionedDetailView',
        'org.konvajs.graph.view.DiagramView',
        'org.ooux.model.OOUXObject',
        'org.ooux.model.OOUXRelationship'
    ],

    exports: [
        'objectDAO'
    ],

    css: `
      ^ {
        display: flex;
        height: 100%;
      }
      ^sidebar {
        width: 280px;
        border-right: 1px solid $borderLight;
        padding: 12px;
        overflow-y: auto;
        flex-shrink: 0;
      }
      ^canvas {
        flex: 1;
        overflow: hidden;
        position: relative;
      }
      ^hint {
        font-size: 11px;
        color: $textSecondary;
        margin: 8px 0;
      }
    `,

    properties: [
        {
            name: 'objectDAO',
            factory: function () {
                var dao = this.EasyDAO.create({
                    of: 'org.ooux.model.OOUXObject',
                    daoType: 'MDAO' // In-memory for now
                });

                // Seeded here rather than in render(), so a re-render doesn't
                // re-seed the board.
                dao.put(this.OOUXObject.create({
                    name: 'User',
                    properties: [
                        { name: 'username', type: 'String' },
                        { name: 'email', type: 'String' }
                    ],
                    x: 50, y: 50
                }));

                dao.put(this.OOUXObject.create({
                    name: 'Product',
                    color: '#e74c3c',
                    properties: [
                        { name: 'sku', type: 'String' },
                        { name: 'price', type: 'Double' }
                    ],
                    x: 300, y: 50
                }));

                return dao;
            }
        },
        {
            name: 'relationshipDAO',
            factory: function() {
                var dao = this.EasyDAO.create({
                    of: 'org.ooux.model.OOUXRelationship',
                    daoType: 'MDAO'
                });
                return dao;
            }
        },
        {
            name: 'diagram'
        },
        {
            name: 'transformer_',
            class: 'Simple'
        },
        { class: 'Boolean', name: 'connectMode' },
        {
            class: 'String',
            name: 'connectSourceId_',
            documentation: `The source card id captured when Connect was
              clicked - by the time the second click changes the
              selection, the first card is no longer selected.`
        }
    ],

    methods: [
        function render() {
            this.SUPER();
            var self = this;

            this.addClass()
                .start().addClass(this.myClass('sidebar'))
                    .start('h3').add('OOUX Board').end()
                    // View exports 'data' (undefined here), which toE would
                    // bind as the buttons' action target; scope them to this
                    // view instead.
                    .startContext({ data: this })
                        .start(this.ADD_OBJECT).end()
                        .start(this.ALIGN_CARDS).end()
                    .endContext()
                    .add(this.slot(function (diagram) {
                        if ( ! diagram ) return this.E();
                        return this.E().add(diagram.slot(function (selected) {
                            if ( ! self.OOUXObject.isInstance(selected) ) return this.E();
                            return this.E()
                                .startContext({ data: self })
                                    .start(self.CONNECT).end()
                                .endContext();
                        }));
                    }))
                    .start('p').addClass(this.myClass('hint'))
                        .add('Scroll to zoom, drag the canvas to pan.')
                    .end()
                    .add(this.slot(function (diagram) {
                        if ( ! diagram ) return this.E();
                        return this.E().add(diagram.slot(function (selected) {
                            if ( ! self.OOUXObject.isInstance(selected) ) {
                                return this.E('p')
                                    .addClass(self.myClass('hint'))
                                    .add('Select an object to edit its properties.');
                            }
                            return this.E().tag(self.SectionedDetailView, {
                                data$: diagram.selected$
                            });
                        }));
                    }))
                .end()

                .start().addClass(this.myClass('canvas'))
                    .tag(this.DiagramView, {
                        nodeDAO: this.objectDAO,
                        edgeDAO: this.relationshipDAO,
                        nodeViewClass: 'org.ooux.view.CardNode',
                        autoLayout: false,
                        // Bound: DiagramView calls this as its own property.
                        onReady: this.initOverlay.bind(this)
                    }, this.diagram$)
                .end();
        },

        function initOverlay(stage, layer) {
            var self = this;

            // One Transformer for the board, retargeted as selection changes.
            this.transformer_ = new Konva.Transformer({
                rotateEnabled: false,
                // Cards have a fixed header and footer, so don't let them be
                // squashed smaller than those plus a sliver of body.
                boundBoxFunc: function (oldBox, newBox) {
                    if (newBox.width < 80 || newBox.height < 100) return oldBox;
                    return newBox;
                }
            });
            layer.add(this.transformer_);

            this.onDetach(this.diagram.selected$.sub(function () {
                self.onSelectionChange();
            }));
        },

        function onSelectionChange() {
            var sel = this.diagram.selected;

            if ( this.connectMode ) {
                if ( ! sel ) {
                    // Empty-canvas click (or removal) cancels a pending
                    // connect.
                    this.connectMode = false;
                } else if ( this.OOUXObject.isInstance(sel) &&
                            sel.id !== this.connectSourceId_ ) {
                    this.relationshipDAO.put(this.OOUXRelationship.create({
                        sourceId: this.connectSourceId_,
                        targetId: sel.id
                    }));
                    this.connectMode = false;
                }
                // An edge or the source card itself keeps connect pending.
            }

            this.syncTransformer();
        },

        function syncTransformer() {
            if ( ! this.transformer_ ) return;

            var sel = this.diagram.selected;
            var nv  = this.OOUXObject.isInstance(sel) ?
                this.diagram.getNodeView(sel.id) : null;

            this.transformer_.nodes(nv && nv.group ? [nv.group] : []);

            // Cards are added after the Transformer, so keep its handles
            // above them.
            this.transformer_.moveToTop();

            var layer = this.transformer_.getLayer();
            if (layer) layer.batchDraw();
        }
    ],

    actions: [
        {
            name: 'addObject',
            label: 'Add Object',
            code: function () {
                // A programmatic selection change must not complete a
                // pending two-click connect.
                this.connectMode = false;
                var obj = this.OOUXObject.create({
                    name: 'New Object ' + Math.floor(Math.random() * 100),
                    x: 100 + Math.random() * 50,
                    y: 100 + Math.random() * 50
                });
                this.objectDAO.put(obj).then(() => this.diagram.selected = obj);
            }
        },
        {
            name: 'alignCards',
            label: 'Align Cards',
            code: function () {
                var self = this;
                // Drag pins cards and the layouter skips pinned nodes, so
                // unpin everything before an explicit layout (MDAO stores by
                // reference, so these are the instances the views render).
                this.objectDAO.select().then(function (sink) {
                    sink.array.forEach(function (obj) { obj.pinned = false; });
                    self.diagram.runLayout();
                });
            }
        },
        {
            name: 'connect',
            label: 'Connect to…',
            code: function () {
                var sel = this.diagram && this.diagram.selected;
                if ( ! this.OOUXObject.isInstance(sel) ) return;
                this.connectSourceId_ = sel.id;
                this.connectMode = true;
            }
        }
    ]
});
