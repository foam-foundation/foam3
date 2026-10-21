/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * A model with 10 Enum properties (plus seq), used as the "enum-heavy"
 * shape in the journal-entry parse-cost shape matrix.
 */
foam.CLASS({
  package: 'foam.dao.test',
  name: 'ReplayEnumModel',

  ids: ['seq'],

  properties: [
    { class: 'Long', name: 'seq' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum0' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum1' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum2' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum3' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum4' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum5' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum6' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum7' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum8' },
    { class: 'Enum', of: 'foam.core.auth.LifecycleState', name: 'enum9' }
  ]
});
