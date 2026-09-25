/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailNode',

  documentation: `
    Geometry tree node: a local box (x, y, width, height), the row the incoming
    track meets it on (entryY), and children positioned in its coordinates.
    Layout code reads and writes these; the SVG renderer turns them into
    nested <g transform="translate(x, y)"> groups. Nothing here knows about
    painting or the DOM.
  `,

  properties: [
    { class: 'Float', name: 'x' },
    { class: 'Float', name: 'y' },
    { class: 'Float', name: 'width' },
    { class: 'Float', name: 'height' },
    {
      class: 'Float',
      name: 'entryY',
      documentation: 'Local y where the incoming track meets this node. Boxes: mid-height. Composites set it in layout().',
      expression: function(height) { return height / 2; }
    },
    { name: 'children', factory: function() { return []; } },
    { name: 'parent' }
  ],

  methods: [
    function add(child) {
      child.parent = this;
      this.children.push(child);
      return this;
    },

    function remove(child) {
      var i = this.children.indexOf(child);
      if ( i >= 0 ) { this.children.splice(i, 1); child.parent = null; }
      return this;
    }
  ]
});
