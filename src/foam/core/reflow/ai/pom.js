foam.POM({
  name: 'reflowai',

  files: [
    // FLOW/Agent command — registered as both 'agent' and '?'
    { name: 'AgentCommand',   flags: 'js|java' },

    // UI controller for interactive LLM prompting
    { name: 'LLMCommand',     flags: 'js|java' },

    // Command to allow LLMs to ask questions and get results
    { name: 'AskCommand', flags: 'js|java' },

    // Block for proposing the execution of another command
    { name: 'Propose', flags: 'js' }
  ]
});
