/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "graph",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "map2d/RelationshipGridPlacementStrategy",            flags: "web" },
    { name: "map2d/ScaleNodeSecondaryRelationshipStrategy",       flags: "web" },
    { name: "Graph",                                              flags: "js" },
    { name: "GraphNode",                                          flags: "js" },
    { name: "GraphBuilder",                                       flags: "js" },
    { name: "TraversalOrder",                                     flags: "js" },
    { name: "WeightPriorityStrategy",                             flags: "js" },
    { name: "GraphTraverser",                                     flags: "js" },
  ]
});
