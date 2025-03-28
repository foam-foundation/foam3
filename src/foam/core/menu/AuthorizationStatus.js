/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.menu',
  name: 'AuthorizationStatus',

  documentation: `
    Describes AuthorizationStatus (i.e. Authenticated, Unauthenticated or Public)
    of a menu, replacing the "authenticate" flag on Menu model.

    Menu accessibility table:
    +-----------------+--------------------+--------------------+-------------------------+
    |      Menu       | Unlogged-in users  |     Anonymous      |     Logged-in users     |
    +-----------------+--------------------+--------------------+-------------------------+
    | Public          | Yes                | Yes                | Yes                     |
    | Authenticated   | Sign-in (redirect) | Sign-in/Permission | Permission              |
    | Unauthenticated | Yes                | Yes                | Default menu (redirect) |
    +-----------------+--------------------+--------------------+-------------------------+

    Public menus are menus that are accessible by anybody.
    Eg. faq, privacy-policy, forgot-password, etc.,.

    Authenticated menus are accessible only by logged-in users.
    Eg. dashboard, update-profile, etc.,.

    Unauthenticated menus are usually "sign-in" and "sign-up" menus which are
    accessible only when users first landed on the app. But after successfully
    sign-in/sign-up, the app would redirect the users to default menu, eg.
    dashboard, that was setup for the user's group.
  `,

  values: [
    {
      name: 'AUTHENTICATED',
      label: 'Authenticated',
      documentation: 'Authenticated menu accessible only by logged-in users (including spid anonymous user) who have menu.read.id permission.'
    },
    {
      name: 'UNAUTHENTICATED',
      label: 'Unauthenticated',
      documentation: 'Unauthenticated menu accessible only by unlogged-in users and spid anonymous user.'
    },
    {
      name: 'PUBLIC',
      label: 'Public',
      documentation: 'Public menu accessible by anybody.'
    }
  ]
});
