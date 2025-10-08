foam.POM({
  name: '{app}',
  excludes: [ '*' ],
  projects: [
    { name: 'foam3/pom'},
    { name: 'src/{packagePath}/pom'},
    { name: 'journals/pom' }
  ],
  licenses: `
    // Add your license header here
  `,
  envs: {
    version: '1.0.0',
    // javaMainArgs: 'spid:{spid}'
  },
  tasks: [
    function javaManifest() {
      JAVA_MANIFEST_VENDOR_ID = '{domain}';
    }
  ]
});
