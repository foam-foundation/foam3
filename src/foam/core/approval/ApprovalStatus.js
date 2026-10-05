/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.ENUM({
  package: 'foam.core.approval',
  name: 'ApprovalStatus',

  values: [
    {
      name: 'REQUESTED',
      label: { en: 'Requested', pt: 'Requeridos'},
      ordinal: 0,
      documentation: 'Request pending.',
      color: '$statusWarnText',
      background: '$statusWarnBackground',
    },
    {
      name: 'APPROVED',
      label: { en: 'Approved', pt: 'Aprovado'},
      ordinal: 1,
      documentation: 'Request was approved.',
      color: '$statusSuccessText',
      background: '$statusSuccessBackground',
    },
    {
      name: 'REJECTED',
      label: { en: 'Rejected', pt: 'Rejeitado'},
      ordinal: 2,
      documentation: 'Request was rejected.',
      color: '$statusDangerText',
      background: '$statusDangerBackground',
    },
    {
      name: 'CANCELLED',
      label: { en: 'Cancelled', pt: 'Cancelado'},
      ordinal: 3,
      documentation: 'Request was cancelled.',
      color: '$statusNeutralText',
      background: '$statusNeutralBackground',
    }
  ]
});
