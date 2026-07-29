/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs.graph',
  name: 'Layouter',
  abstract: true,

  documentation: `Layout engine interface. layout() is async so engines that
    load or compute off-thread fit the same contract. Returned node
    positions are top-left coordinates (GraphNode convention). Nodes absent
    from the result (e.g. pinned) keep their current position; edges absent
    from the result render as straight lines.`,

  methods: [
    function layout(nodes, edges) {
      /** @return Promise of { nodes: {id: {x,y}}, edges: {id: {points: []}} } */
      return Promise.resolve({ nodes: {}, edges: {} });
    }
  ]
});
