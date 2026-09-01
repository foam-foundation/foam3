foam.POM({
  name: 'lsp-test',
  files: [
    { name: 'FoamIndexTest', flags: 'js&test|java&test' },
    { name: 'FoamClassGrammarTest', flags: 'js&test|java&test' },
    { name: 'HandlersTest', flags: 'js&test|java&test' },
    { name: 'LSPIntegrationTest', flags: 'js&test|java&test' },
    { name: 'JavaBlockValidatorTest', flags: 'js&test|java&test' },
    { name: 'CSSTokenResolverTest', flags: 'js&test|java&test' }
  ]
});
