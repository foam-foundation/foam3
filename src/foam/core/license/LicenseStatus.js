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
      name: 'INITIATED',
      label: { en: 'Initiated', fr: 'Initié' },
      documentation: 'License has been newly created (count is unknown)',
      color: '$grey700',
      background: '$grey100'
    },
    {
      name: 'COMPLIANT',
      label: { en: 'Compliant', fr: 'Conforme' },
      documentation: 'License has not been exceeded (count is within quota)',
      color: '$success700',
      background: '$success50'
    },
    {
      name: 'EXCEEDED',
      label: { en: 'Exceeded', fr: 'Dépassé' },
      documentation: 'License has been exceeded (count exceeds quota)',
      color: '$destructive500',
      background: '$destructive50'
    }
  ]
});