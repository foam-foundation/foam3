foam.POM({
  name: 'yourprojectname',

  version: '1',

  excludes: [ 'build', 'deployment', 'node_modules', 'foam3' ],

  licenses: [
    `
    Copyright 2025 XXX Inc. All Rights Reserved.
    `
  ],

  setFlags: {
  },

  copy: [
    // { source: 'favicon',     targetDir: 'webroot/favicon' }
  ],

  projects: [
    { name: 'foam3/pom' }
    // { name: 'src/com/yourdomain/youproject/yoursubproject/pom' },
  ],

  files: [
    // { name: 'src/com/yourdomain/yourproject/YourModel', flags: 'js|java' }
  ],

  javaFiles: [
    // { name: 'src/com/yourdomain/yourprojet/YourFile.java' }
  ],

  javaDependencies: [
  ]
});
