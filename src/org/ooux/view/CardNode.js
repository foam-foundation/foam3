/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.ooux.view',
    name: 'CardNode',

    documentation: `A single OOUXObject drawn as a Konva card.

      createNode() builds the group once. Everything after that goes through
      updateNode(), which mutates the existing Konva nodes in place - the card
      is never destroyed and rebuilt, so a drag, a selection or a transform in
      progress survives a model change.

      The node subscribes to its own model, so editing the object anywhere -
      the sidebar detail view, another client, a script - redraws the card.`,

    requires: [
        'org.ooux.model.OOUXObject'
    ],

    constants: {
        HEADER_HEIGHT: 40,
        FOOTER_HEIGHT: 40
    },

    properties: [
        {
            class: 'FObjectProperty',
            of: 'org.ooux.model.OOUXObject',
            name: 'data',
            postSet: function (_, data) {
                // Follow the new model. A put() of a different instance with
                // the same id replaces 'data', and the old subscription would
                // otherwise keep listening to an object nothing points at.
                this.listenToData();
                this.updateNode();
            }
        },
        {
            name: 'dataSub_',
            class: 'Simple'
        },
        {
            name: 'group',
            class: 'Simple'
        },
        {
            name: 'parts_',
            class: 'Simple',
            documentation: 'The individual Konva shapes, kept for updateNode().'
        },
        {
            class: 'Function',
            name: 'onMoved',
            documentation: `Called with the model after a drag or resize. The
              board uses this to put() the object back, so the change raises a
              DAO event and survives a DAO that doesn't store by reference.`,
            value: function (data) { }
        },
        {
            class: 'Function',
            name: 'onSelected',
            documentation: 'Called with the model when the card is clicked.',
            value: function (data) { }
        },
        {
            class: 'Function',
            name: 'onDragMove',
            documentation: 'Called with (id, x, y) continuously during a drag so edges can track.',
            value: function(id, x, y) { }
        }
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

            var header = new Konva.Rect({
                width: data.width,
                height: this.HEADER_HEIGHT,
                fill: data.color,
                stroke: 'black',
                strokeWidth: 1,
                cornerRadius: [10, 10, 0, 0]
            });

            var title = new Konva.Text({
                x: 10,
                y: 12,
                text: data.name,
                fontSize: 16,
                fontStyle: 'bold',
                fill: 'white',
                width: data.width - 20,
                align: 'left'
            });

            var body = new Konva.Rect({
                y: this.HEADER_HEIGHT,
                width: data.width,
                height: this.bodyHeight(data),
                fill: 'white',
                stroke: 'black',
                strokeWidth: 1
            });

            var propText = new Konva.Text({
                x: 10,
                y: this.HEADER_HEIGHT + 10,
                text: this.propertyText(data),
                fontSize: 14,
                fill: '#333',
                width: data.width - 20
            });

            var footer = new Konva.Rect({
                y: data.height - this.FOOTER_HEIGHT,
                width: data.width,
                height: this.FOOTER_HEIGHT,
                fill: '#ecf0f1',
                stroke: 'black',
                strokeWidth: 1,
                cornerRadius: [0, 0, 10, 10]
            });

            group.add(header);
            group.add(body);
            group.add(footer);
            group.add(title);
            group.add(propText);

            this.parts_ = {
                header: header,
                body: body,
                footer: footer,
                title: title,
                propText: propText
            };
            this.group = group;

            group.on('click tap', function () {
                self.onSelected(self.data);
            });

            group.on('dragend', function (e) {
                self.data.x = e.target.x();
                self.data.y = e.target.y();
                self.onMoved(self.data);
            });

            group.on('dragmove', function() {
                self.onDragMove(self.data.id, group.x(), group.y());
            });

            // A Transformer scales the group rather than resizing it, so bake
            // the scale back into width/height and reset it. Without this the
            // text and borders would scale too, and the model would never see
            // the new size.
            group.on('transformend', function () {
                var scaleX = group.scaleX();
                var scaleY = group.scaleY();
                var model  = self.data;

                group.scale({ x: 1, y: 1 });

                model.width  = Math.max(80, model.width * scaleX);
                model.height = Math.max(
                    self.HEADER_HEIGHT + self.FOOTER_HEIGHT + 20,
                    model.height * scaleY);
                model.x = group.x();
                model.y = group.y();

                self.updateNode();
                self.onMoved(model);
            });

            // Redraw whenever the model changes, wherever the change came from.
            this.listenToData();
            this.onDetach(function () {
                if (self.dataSub_) self.dataSub_.detach();
            });

            return group;
        },

        function listenToData() {
            var self = this;

            if (this.dataSub_) {
                this.dataSub_.detach();
                this.dataSub_ = null;
            }
            if (!this.data) return;

            this.dataSub_ = this.data.propertyChange.sub(function () {
                self.updateNode();
            });
        },

        function updateNode() {
            /** Reconciles the existing Konva nodes with the model. **/
            if (!this.group) return;

            var data = this.data;
            var p = this.parts_;

            this.group.position({ x: data.x, y: data.y });

            p.header.width(data.width);
            p.header.fill(data.color);

            p.title.text(data.name);
            p.title.width(data.width - 20);

            p.body.width(data.width);
            p.body.height(this.bodyHeight(data));

            p.propText.text(this.propertyText(data));
            p.propText.width(data.width - 20);

            p.footer.width(data.width);
            p.footer.y(data.height - this.FOOTER_HEIGHT);

            var layer = this.group.getLayer();
            if (layer) layer.batchDraw();
        },

        function bodyHeight(data) {
            return Math.max(0, data.height - this.HEADER_HEIGHT - this.FOOTER_HEIGHT);
        },

        function propertyText(data) {
            return (data.properties || []).map(p => '- ' + p.name).join('\n');
        },

        function removeNode() {
            /** Removes the Konva node. Callers must also detach() this object
              to drop its model subscription. **/
            if (this.group) {
                this.group.destroy();
                this.group = null;
            }
        }
    ]
});
