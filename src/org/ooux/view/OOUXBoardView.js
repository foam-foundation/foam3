/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.ooux.view',
    name: 'OOUXBoardView',
    extends: 'foam.u2.View',

    documentation: `An OOUX board: objects live in a DAO, the Konva canvas is
      a projection of that DAO.

      Selection is a FOAM property rather than Konva state, which is what makes
      the sidebar work - the detail view binds to the same 'selected' slot the
      Transformer follows, so editing a field redraws the card and clicking a
      card populates the editor, with no code connecting the two.

      Cards are reconciled, never rebuilt: a put() updates the existing Konva
      node in place so a drag or transform in progress isn't interrupted.`,

    requires: [
        'foam.dao.EasyDAO',
        'foam.u2.detail.SectionedDetailView',
        'org.konvajs.KonvaView',
        'org.ooux.model.OOUXObject',
        'org.ooux.view.CardNode'
    ],

    exports: [
        'objectDAO',
        'selected'
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
            class: 'FObjectProperty',
            of: 'org.ooux.model.OOUXObject',
            name: 'selected',
            documentation: `The selected object, or null. Both the Transformer
              and the sidebar detail view follow this one slot.`
        },
        {
            name: 'konvaView'
        },
        {
            name: 'transformer_',
            class: 'Simple'
        },
        {
            // Deliberately not 'Simple': that class installs nothing on the
            // prototype, so its factory would never run and this would read
            // back undefined.
            name: 'cards_',
            documentation: 'Map of object id -> CardNode.',
            factory: function () { return {}; }
        }
    ],

    methods: [
        function render() {
            this.SUPER();
            var self = this;

            this.addClass()
                .start().addClass(this.myClass('sidebar'))
                    .start('h3').add('OOUX Board').end()
                    .start(this.ADD_OBJECT).end()
                    .start('p').addClass(this.myClass('hint'))
                        .add('Scroll to zoom, drag the canvas to pan.')
                    .end()
                    .add(this.slot(function (selected) {
                        if (!selected) {
                            return this.E('p')
                                .addClass(self.myClass('hint'))
                                .add('Select an object to edit its properties.');
                        }
                        return this.E().tag(self.SectionedDetailView, {
                            data$: self.selected$
                        });
                    }))
                .end()

                .start().addClass(this.myClass('canvas'))
                    .tag(this.KonvaView, {
                        fillContainer: true,
                        pannable: true,
                        zoomable: true,
                        // Bound: KonvaView calls this as its own property, so
                        // an unbound method would run with the KonvaView as
                        // 'this'.
                        onStageReady: this.initBoard.bind(this)
                    }, this.konvaView$)
                .end();
        },

        function initBoard(stage, layer) {
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

            this.onDetach(this.selected$.sub(function () {
                self.syncTransformer();
            }));

            // Clicking empty canvas clears the selection.
            stage.on('click tap', function (e) {
                if (e.target === stage) self.selected = null;
            });

            this.onDetach(this.objectDAO.on.put.sub(function (_, __, ___, obj) {
                var card = self.cards_[obj.id];
                if (card) {
                    // Reconcile in place. The card's own propertyChange
                    // subscription already redraws when the same object
                    // instance is mutated; this covers a put() of a different
                    // instance carrying the same id.
                    card.data = obj;
                    card.updateNode();
                } else {
                    self.addCard(obj, layer);
                }
                layer.batchDraw();
            }));

            this.onDetach(this.objectDAO.on.remove.sub(function (_, __, ___, obj) {
                self.removeCard(obj.id);
                if (self.selected && self.selected.id === obj.id) {
                    self.selected = null;
                }
                layer.batchDraw();
            }));

            // Initial load. The listeners above only fire for later changes.
            this.objectDAO.select().then(function (sink) {
                sink.array.forEach(obj => self.addCard(obj, layer));
                layer.batchDraw();
            });

            this.onDetach(function () {
                Object.keys(self.cards_).forEach(id => self.removeCard(id));
            });
        },

        function addCard(obj, layer) {
            var self = this;

            var card = this.CardNode.create({
                data: obj,
                onSelected: function (data) { self.selected = data; },
                onMoved: function (moved) {
                    // Persist and raise a DAO event. The put listener finds an
                    // existing card and reconciles, so this doesn't disturb
                    // the node the user is holding.
                    self.objectDAO.put(moved);
                }
            }, this);

            layer.add(card.createNode());
            this.cards_[obj.id] = card;

            // A newly added card may be the one already selected.
            if (this.selected && this.selected.id === obj.id) this.syncTransformer();

            return card;
        },

        function removeCard(id) {
            var card = this.cards_[id];
            if (!card) return;
            card.removeNode();
            card.detach();
            delete this.cards_[id];
        },

        function syncTransformer() {
            if (!this.transformer_) return;

            var card = this.selected && this.cards_[this.selected.id];
            this.transformer_.nodes(card && card.group ? [card.group] : []);

            // Cards are added after the Transformer, so keep its handles above
            // them.
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
                var obj = this.OOUXObject.create({
                    name: 'New Object ' + Math.floor(Math.random() * 100),
                    x: 100 + Math.random() * 50,
                    y: 100 + Math.random() * 50
                });
                this.objectDAO.put(obj).then(() => this.selected = obj);
            }
        }
    ]
});
