foam.POM({
  name: 'lsp-handlers',
  files: [
    { name: 'CompletionHandler', flags: 'js' },
    { name: 'HoverHandler', flags: 'js' },
    { name: 'DefinitionHandler', flags: 'js' },
    { name: 'DiagnosticsHandler', flags: 'js' },
    { name: 'JavaBlockValidator', flags: 'js' },
    { name: 'SymbolHandler', flags: 'js' },
    { name: 'MemberCompletionHandler', flags: 'js' },
    { name: 'SemanticTokenHandler', flags: 'js' },
    { name: 'ReferencesHandler', flags: 'js' },
    { name: 'DocumentHighlightHandler', flags: 'js' },
    { name: 'RenameHandler', flags: 'js' },
    { name: 'WorkspaceAnalyzer', flags: 'js' },
    { name: 'JrlHandler', flags: 'js' }
  ]
});
