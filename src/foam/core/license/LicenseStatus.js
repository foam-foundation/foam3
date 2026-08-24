/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.license',
  name: 'LicenseStatus',

  values: [
    {
      name: 'COMPLIANT',
      label: { en: 'Compliant', fr: 'Conforme' },
      ordinal: 0,
      documentation: 'License has not been violated (count is within quota)',
      color: '$success700',
      background: '$success50'
    },
    {
      name: 'VIOLATED',
      label: { en: 'Violated', fr: 'Enfreindre' },
      ordinal: 1,
      documentation: 'License has been violated (count exceeds quota)',
      color: '$destructive500',
      background: '$destructive50'
    },
    {
      name: 'INITIATED',
      label: { en: 'Initiated', fr: 'Initié' },
      ordinal: 2,
      documentation: 'License has been newly created (count is unknown)',
      color: '$grey700',
      background: '$grey100'
    }
  ]
});