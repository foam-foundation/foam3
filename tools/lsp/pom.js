foam.POM({
  name: 'lsp',
  files: [
    { name: 'FileModelCache', flags: 'js' },
    { name: 'TypeTracker', flags: 'js' },
    { name: 'CursorSentinel', flags: 'js' },
    { name: 'CompletionItem', flags: 'js' },
    { name: 'Diagnostic', flags: 'js' },
    { name: 'FoamIndex', flags: 'js' },
    { name: 'FoamClassGrammar', flags: 'js' },
    { name: 'CursorAnalyzer', flags: 'js' },
    { name: 'CSSTokenResolver', flags: 'js' },
    { name: 'JrlLoader', flags: 'js' },
    { name: 'JavaGrammar', flags: 'js' },
    { name: 'JavaParser', flags: 'js' }
  ],
  projects: [
    { name: 'handlers/pom' },
    { name: 'test/pom', flags: 'test' }
  ]
});
