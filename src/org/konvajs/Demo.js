/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.konvajs',
    name: 'Demo',
    extends: 'foam.u2.Controller',

    requires: [
        'org.konvajs.KonvaView'
    ],

    methods: [
        function render() {
            this.start()
                .start('h1').add('OOUX Board Prototype').end()
                .start('p').add('Drag the card, or click it to see resize handles.').end()
                .tag(this.KonvaView, {
                    width: 1000,
                    height: 800,
                    // Bound: KonvaView invokes this as its own property.
                    onStageReady: this.drawOOUXCard.bind(this)
                })
                .end();
        },

        function drawOOUXCard(stage, layer) {
            // --- OOUX Card Prototype ---
            // Mimicking an "Object" card: Header (Name), Body (Attributes), Footer (Actions)

            var cardGroup = new Konva.Group({
                x: 100,
                y: 100,
                draggable: true,
                name: 'ooux-card'
            });

            // 1. Header (Blue)
            var header = new Konva.Rect({
                x: 0,
                y: 0,
                width: 200,
                height: 40,
                fill: '#3498db',
                stroke: 'black',
                strokeWidth: 2,
                cornerRadius: [10, 10, 0, 0]
            });

            var headerText = new Konva.Text({
                x: 10,
                y: 10,
                text: 'USER (Object)', // OOUX Object Name
                fontSize: 18,
                fontStyle: 'bold',
                fill: 'white',
                width: 180,
                align: 'center'
            });

            // 2. Body (White - Attributes)
            var body = new Konva.Rect({
                x: 0,
                y: 40,
                width: 200,
                height: 100,
                fill: 'white',
                stroke: 'black',
                strokeWidth: 2
            });

            var bodyText = new Konva.Text({
                x: 10,
                y: 50,
                text: '- Name\n- Email\n- Role\n- Avatar', // Attributes
                fontSize: 14,
                fill: '#333',
                lineHeight: 1.5
            });

            // 3. Footer (Gray - Actions/CTAs)
            var footer = new Konva.Rect({
                x: 0,
                y: 140,
                width: 200,
                height: 40,
                fill: '#ecf0f1',
                stroke: 'black',
                strokeWidth: 2,
                cornerRadius: [0, 0, 10, 10]
            });

            var footerText = new Konva.Text({
                x: 10,
                y: 150,
                text: '[Login] [Update]', // CTAs
                fontSize: 14,
                fill: '#555',
                width: 180,
                align: 'center'
            });

            // Add everything to group
            cardGroup.add(header);
            cardGroup.add(body);
            cardGroup.add(footer);
            cardGroup.add(headerText);
            cardGroup.add(bodyText);
            cardGroup.add(footerText);

            layer.add(cardGroup);

            // --- Transformer (Resizing) ---
            var tr = new Konva.Transformer();
            layer.add(tr);

            // Click to select
            cardGroup.on('click tap', function (e) {
                tr.nodes([cardGroup]);
            });

            // Click on empty stage to deselect
            stage.on('click tap', function (e) {
                if (e.target === stage) {
                    tr.nodes([]);
                }
            });

            layer.draw();
        }
    ]
});
