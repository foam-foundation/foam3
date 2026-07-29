/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.ooux.view',
    name: 'CardNode',
    extends: 'org.konvajs.graph.view.GraphNodeView',

    documentation: `A single OOUXObject drawn as a Konva card (colored
      header, white body listing properties, footer). Rendering only: the
      lifecycle - group creation, drag/click wiring, model subscription -
      lives in GraphNodeView.

      transformend is card-specific policy (cards resize via the board's
      Transformer, graph nodes don't): a Transformer scales the group
      rather than resizing it, so bake the scale back into width/height,
      clamp minimums, and reset the scale. Without this the text and
      borders would scale too, and the model would never see the new
      size.`,

    constants: {
        HEADER_HEIGHT: 40,
        FOOTER_HEIGHT: 40
    },

    properties: [
        {
            name: 'parts_',
            class: 'Simple',
            documentation: 'The individual Konva shapes, kept for reconcileShapes().'
        }
    ],

    methods: [
        function buildShapes(group) {
            var self = this;
            var data = this.data;

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

            group.on('transformend', function () {
                var scaleX = group.scaleX();
                var scaleY = group.scaleY();
                // Capture before writing: each model write triggers
                // updateNode() synchronously, which repositions the group
                // from the half-updated model.
                var x      = group.x();
                var y      = group.y();
                var model  = self.data;

                group.scale({ x: 1, y: 1 });

                model.width  = Math.max(80, model.width * scaleX);
                model.height = Math.max(
                    self.HEADER_HEIGHT + self.FOOTER_HEIGHT + 20,
                    model.height * scaleY);
                model.x = x;
                model.y = y;

                self.updateNode();
                self.onMoved(model);
            });
        },

        function reconcileShapes() {
            if ( ! this.parts_ ) return;

            var data = this.data;
            var p = this.parts_;

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
        },

        function applyState() {
            // Selection is shown by the board's Transformer, not card
            // styling; keep the base from painting graph-style highlights.
        },

        function bodyHeight(data) {
            return Math.max(0, data.height - this.HEADER_HEIGHT - this.FOOTER_HEIGHT);
        },

        function propertyText(data) {
            return (data.properties || []).map(p => '- ' + p.name).join('\n');
        }
    ]
});
