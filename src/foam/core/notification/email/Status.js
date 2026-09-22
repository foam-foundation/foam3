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
      color: '$statusNeutralText',
      background: '$statusNeutralBackground',
    },
    {
      name: 'UNSENT',
      label: 'Unsent',
      color: '$statusNeutralText',
      background: '$statusNeutralBackground',
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
      color: '$statusWarnText',
      background: '$statusWarnBackground',
    },
    {
      name: 'RECEIVED',
      label: 'Received',
      color: '$statusInfoText',
      background: '$statusNeutralBackground',
    },
    {
      name: 'PROCESSED',
      label: 'Processed',
      color: '$statusSuccessText',
      background: '$statusSuccessBackground',
    }
  ]
});
