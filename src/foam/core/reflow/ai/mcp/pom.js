foam.POM({
  name: 'reflowwebmcp',

  files: [
    // Registers the Console as an in-page MCP server. Client-side only: the
    // tools it exposes are the Console's own eval_ and rendered block output.
    { name: 'ReflowWebMCP', flags: 'js' },

    // The 'mcp' command: registers the tools and prints the connection steps.
    // js|java like every other Command with a cmds.jrl row -- commandDAO
    // replays server-side, so the class has to exist in Java to deserialize.
    // execute() is JS-only, which generates nothing (java/refinements.js:1021).
    { name: 'MCPCommand',   flags: 'js|java' }
  ]
});
