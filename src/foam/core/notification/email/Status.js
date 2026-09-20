/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.notification.email',
  name: 'Status',

  documentation: `
    Status of an email message.
  `,

  properties: [
    {
      class: 'String',
      name: 'errorMessage'
    }
  ],

  values: [
    {
      name: 'DRAFT',
      label: 'Draft',
      color: '$textSecondary',
      background: '$backgroundSecondary',
    },
    {
      name: 'UNSENT',
      label: 'Unsent',
      color: '$textSecondary',
      background: '$backgroundSecondary',
    },
    {
      name: 'SENT',
      label: 'Sent',
      color: '$statusSuccessText',
      background: '$statusSuccessBackground',
    },
    {
      name: 'FAILED',
      label: 'Failed',
      color: '$statusDangerText',
      background: '$statusDangerBackground',
    },
    {
      name: 'BOUNCED',
      label: 'Bounced',
      color: '$warn500',
      background: '$warn700',
    },
    {
      name: 'RECEIVED',
      label: 'Received',
      color: '$textBrand',
      background: '$backgroundSecondary',
    },
    {
      name: 'PROCESSED',
      label: 'Processed',
      color: '$statusSuccessText',
      background: '$statusSuccessBackground',
    }
  ]
});
