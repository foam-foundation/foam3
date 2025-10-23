/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "autocomplete",

  projects: [
    { name: '../../../../foam3/src/pom' },
    { name: '../../../../foam3/src/foam/core/pom' }
  ],

  files: [
    { name: 'FScriptQueryController' },
    { name: 'QueryController' }
  ]
});
