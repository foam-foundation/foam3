/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.benchmark',
  name: 'ReplayNarrowModel',

  documentation: 'Five properties: the narrow end of the replay benchmark model axis.',

  properties: [
    { class: 'Long',     name: 'id' },
    { class: 'String',   name: 'label' },
    { class: 'String',   name: 'code' },
    { class: 'Double',   name: 'amount' },
    { class: 'DateTime', name: 'at' }
  ]
});
