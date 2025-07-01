/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "ms",
  version: 3,
  licenses: [
    `
    Copyright 2025 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],
  files: [
    { name: "EmailServiceConfig",             flags: "js|java" },
    { name: "MicrosoftGraphEmailAgent",       flags: "js|java" }
  ],
  javaDependencies: [
    'com.azure:azure-identity:1.15.4',
    'com.microsoft.ews-java-api:ews-java-api:2.0',
    'javax.xml.bind:jaxb-api:2.3.1',
    'javax.xml.ws:jaxws-api:2.3.1'
  ]
});