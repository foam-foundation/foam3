foam.POM({
  name: 'ai',

  projects: [
    { name: '../../ai/llm/pom' },
    { name: 'llm/pom' },
    { name: 'vector/pom' },
    // ML training (datasets, training and eval runs) is opt-in: an app that
    // wants it sets the ml flag, e.g. setFlags: { ml: true } in its POM.
    { name: 'dataset/pom',  flags: 'ml' },
    { name: 'training/pom', flags: 'ml' }
  ],

  javaFiles: [
    { name: 'mcp/MCPWebAgent' }
  ]
});
