/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// 70 properties, so the flags need a second word (bits 64..69).
var packIsSetTestProperties = [];
for ( var i = 0 ; i < 70 ; i++ ) {
  packIsSetTestProperties.push({ class: i % 2 ? 'String' : 'Long', name: 'p' + i });
}

foam.CLASS({
  package: 'foam.lang',
  name: 'PackIsSetTestModel',
  javaPackIsSet: true,
  properties: packIsSetTestProperties
});
