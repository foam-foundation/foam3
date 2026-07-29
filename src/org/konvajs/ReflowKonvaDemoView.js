/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
    package: 'org.konvajs',
    name: 'ReflowKonvaDemoView',
    extends: 'foam.u2.view.MarkdownView',

    properties: [
        {
            name: 'data',
            value: `## Konva in Markdown

Here is a rectangle defined in JSON:

\`\`\`konva
[
  { "class": "Rect", "x": 50, "y": 50, "width": 100, "height": 100, "fill": "green", "draggable": true },
  { "class": "Circle", "x": 200, "y": 100, "radius": 40, "fill": "blue", "draggable": true }
]
\`\`\`

Live rendering above!`
        }
    ]
});
