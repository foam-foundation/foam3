/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs.graph',
  name: 'GraphEdge',

  documentation: `A diagram edge between two GraphNode ids. 'points' is a
    flat [x0, y0, x1, y1, ...] polyline supplied by a layouter; it is
    view-transient and never stored. A dangling sourceId/targetId means the
    edge is not rendered (temp-node materialization is an application-layer
    concern, not a primitive).`,

  properties: [
    {
      class: 'String',
      name: 'id',
      factory: function() { return foam.uuid.randomGUID(); }
    },
    { class: 'String', name: 'label' },
    { class: 'String', name: 'sourceId' },
    { class: 'String', name: 'targetId' },
    {
      class: 'String',
      name: 'style',
      value: 'arrow'
    },
    {
      class: 'String',
      name: 'state',
      value: 'normal'
    },
    {
      class: 'Simple',
      name: 'points'
    }
  ]
});
