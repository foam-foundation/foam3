/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Ten reference properties that live in the sparse store, one primitive that keeps its field.
var sparseTestProperties = [];
for ( var i = 0 ; i < 10 ; i++ ) sparseTestProperties.push({ class: 'String', name: 's' + i });
sparseTestProperties.push({ class: 'Long', name: 'n0' });

foam.CLASS({
  package: 'foam.lang',
  name: 'SparseTestModel',
  javaSparse: true,
  properties: sparseTestProperties
});
