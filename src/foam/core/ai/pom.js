foam.POM({
  name: 'ai',

  projects: [
    { name: '../../ai/llm/pom' },
    { name: 'llm/pom' },
    { name: 'vector/pom' },
    { name: 'dataset/pom' }
  ],

  javaFiles: [
    { name: 'mcp/MCPWebAgent' }
  ]
});
