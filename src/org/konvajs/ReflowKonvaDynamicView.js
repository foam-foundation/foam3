/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs',
  name: 'ReflowKonvaDynamicView',
  extends: 'foam.u2.view.MarkdownView',

  properties: [
    {
      // The markdown below is a hardcoded literal in this file, so executing
      // it is safe. MarkdownView leaves this off by default precisely so that
      // user-authored markdown can never reach the script path.
      name: 'allowScript',
      value: true
    },
    {
      name: 'data',
      value: `## Dynamic Konva with FOAM

You can access the FOAM context as \`x\`.

\`\`\`konva
// We can now use full FOAM code!
// Argument 'x' is the FOAM context.

console.log("Context available:", x);

// Generative Art: Phyllotaxis (Sunflower) Pattern
var shapes = [];
var numPoints = 150;
var c = 12; // spread factor
var centerX = 300;
var centerY = 150;

for (var n = 0; n < numPoints; n++) {
  // Golden angle
  var angle = n * 137.5 * (Math.PI / 180);
  var r = c * Math.sqrt(n);
  
  var x = centerX + r * Math.cos(angle);
  var y = centerY + r * Math.sin(angle);
  
  shapes.push({
    class: 'Circle',
    x: x,
    y: y,
    radius: 3 + (n / 25),
    fill: 'hsl(' + (n * 2) % 360 + ', 70%, 50%)',
    stroke: 'black',
    strokeWidth: 1,
    draggable: true,
    shadowBlur: 2,
    shadowOpacity: 0.5
  });
}

// Add a central text
shapes.push({
  class: 'Text',
  x: centerX - 60,
  y: 20,
  text: 'Interactive Math',
  fontSize: 18,
  fontStyle: 'bold',
  fill: '#333'
});

return shapes;
\`\`\`
`
    }
  ]
});
