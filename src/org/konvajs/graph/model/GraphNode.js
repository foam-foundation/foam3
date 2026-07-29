/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs.graph',
  name: 'GraphNode',

  documentation: `A diagram node. x/y is the top-left of the node's Konva
    group. 'state' is transient render state (normal | highlighted |
    processing | pseudo | temp | collapsed) and must be excluded from any
    future serialization. 'pinned' is set when the user drags the node;
    layouters skip pinned nodes.`,

  properties: [
    {
      class: 'String',
      name: 'id',
      factory: function() { return foam.uuid.randomGUID(); }
    },
    {
      class: 'String',
      name: 'label',
      value: 'Node'
    },
    { class: 'Double', name: 'x' },
    { class: 'Double', name: 'y' },
    { class: 'Double', name: 'width',  value: 120 },
    { class: 'Double', name: 'height', value: 48 },
    {
      class: 'Color',
      name: 'color',
      value: '#3498db'
    },
    {
      class: 'String',
      name: 'state',
      value: 'normal'
    },
    { class: 'Boolean', name: 'pinned' }
  ]
});
