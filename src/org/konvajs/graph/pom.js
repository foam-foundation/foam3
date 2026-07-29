foam.POM({
  name: "konvajs-graph",

  files: [
    { name: "DagreLib",        flags: "web" },
    { name: "model/GraphNode", flags: "web" },
    { name: "model/GraphEdge", flags: "web" },
    { name: "Layouter",        flags: "web" },
    { name: "DagreLayouter",   flags: "web" },
    { name: "view/GraphEdgeView", flags: "web" }
  ]
});
