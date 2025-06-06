/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.comics.v2.userfeedback',
  name: 'UserFeedbackAlertType',
  documentation: `
    Userfeedback alert type determines how a userfeedback exception is to be displayed.

    - ALERT, show userfeedback exception as styled modal alert container on the detail view
    - NOTIFICATION, show userfeedback exception as toast notification
  `,

  values: [
    { name: 'NOTIFICATION', label: 'Notification' },
    { name: 'ALERT',        label: 'Alert' }
  ]
});
