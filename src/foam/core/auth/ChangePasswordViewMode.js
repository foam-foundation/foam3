/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.auth',
  name: 'ChangePasswordViewMode',
  documentation: `
    Enum to determine if a ChangePasswordView renders as an embedded page, a standalone page, or a pop-up
  `,

  values: [
    {
      name: 'EMBEDDED',
      label: 'Embedded',
      documentation: 'Plain content inside an existing page, e.g. Settings.'
    },
    {
      name: 'STANDALONE',
      label: 'Standalone',
      documentation: 'Full page wrapped in StatusPageBorder with a Back link.'
    },
    {
      name: 'POPUP',
      label: 'Popup',
      documentation: 'Content sized for a foam.u2.dialog.Popup; closes via closeDialog.'
    }
  ]
});