/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'FlowAuthorizationTest',
  extends: 'foam.core.test.Test',

  documentation: `A save is checked against the flow as stored, and only its creator or an
    admin may change who can reach it. Runs the Flow authorize methods directly, as a user who
    is not the creator and holds no permissions, so only the access rules decide.`,

  javaImports: [
    'foam.core.auth.AuthorizationException',
    'foam.core.auth.ProxyAuthService',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.reflow.Flow',
    'foam.core.reflow.FlowAccess',
    'foam.core.reflow.UserFlowAccess',
    'foam.lang.X'
  ],

  constants: [
    { name: 'CREATOR_ID', type: 'Long', value: 1001 },
    { name: 'USER_ID',    type: 'Long', value: 1002 }
  ],

  methods: [
    {
      name: 'runTest',
      javaCode: `
        User user = new User();
        user.setId(USER_ID);
        // An auth service that grants nothing, so checkBypassAuthorization ("*") is false.
        X ux = x.put("subject", new Subject(user)).put("auth", new ProxyAuthService() {
          @Override
          public boolean check(X x, String permission) { return false; }
        });

        Flow readOnly = flow(FlowAccess.PUBLIC_RO);
        Flow opened = (Flow) readOnly.fclone();
        opened.setAccessLevel(FlowAccess.PUBLIC_RW);
        test(! canUpdate(ux, readOnly, opened),
          "A PUBLIC_RO flow stays read-only whatever access the saved copy carries");

        Flow claimed = (Flow) readOnly.fclone();
        claimed.setCreatedBy(USER_ID);
        test(! canUpdate(ux, readOnly, claimed),
          "A PUBLIC_RO flow stays read-only whatever creator the saved copy carries");

        Flow readWrite = flow(FlowAccess.PUBLIC_RW);
        Flow edited = (Flow) readWrite.fclone();
        edited.setDescription("edited");
        test(canUpdate(ux, readWrite, edited),
          "An editor of a PUBLIC_RW flow can change its content");

        Flow madePrivate = (Flow) readWrite.fclone();
        madePrivate.setAccessLevel(FlowAccess.PRIVATE);
        madePrivate.setCreatedBy(USER_ID);
        test(! canUpdate(ux, readWrite, madePrivate),
          "Only the creator or an admin changes a flow's access level or creator");

        Flow madeShared = (Flow) readWrite.fclone();
        madeShared.setAccessLevel(FlowAccess.SHARED);
        madeShared.setSpecifiedUserAccess(new UserFlowAccess[] { readWriteFor(USER_ID) });
        test(! canUpdate(ux, readWrite, madeShared),
          "Only the creator or an admin changes a flow's access list");

        Flow claimedOnly = (Flow) readWrite.fclone();
        claimedOnly.setCreatedBy(USER_ID);
        test(! canUpdate(ux, readWrite, claimedOnly),
          "Only the creator or an admin changes a flow's creator");

        Flow shared = flow(FlowAccess.SHARED);

        shared.setSpecifiedUserAccess(new UserFlowAccess[] { readWriteFor(USER_ID) });
        Flow sharedEdit = (Flow) shared.fclone();
        sharedEdit.setDescription("edited");
        test(canUpdate(ux, shared, sharedEdit),
          "A user listed with PUBLIC_RW on a SHARED flow can change its content");

        Flow relisted = (Flow) shared.fclone();
        relisted.setSpecifiedUserAccess(new UserFlowAccess[] { readWriteFor(USER_ID), readWriteFor(CREATOR_ID + 1000) });
        test(! canUpdate(ux, shared, relisted),
          "A user listed with PUBLIC_RW cannot change a SHARED flow's access list");

        Flow own = flow(FlowAccess.PRIVATE);
        own.setCreatedBy(USER_ID);
        Flow ownEdit = (Flow) own.fclone();
        ownEdit.setAccessLevel(FlowAccess.PUBLIC_RO);
        test(canUpdate(ux, own, ownEdit),
          "The creator can change their own flow's access level");

        boolean deleteDenied = false;
        try {
          readOnly.authorizeOnDelete(ux);
        } catch ( AuthorizationException e ) {
          deleteDenied = true;
        }
        test(deleteDenied, "A PUBLIC_RO flow cannot be deleted");
      `
    },
    {
      name: 'canUpdate',
      type: 'Boolean',
      args: 'X x, Flow stored, Flow saved',
      javaCode: `
        try {
          saved.authorizeOnUpdate(x, stored);
          return true;
        } catch ( AuthorizationException e ) {
          return false;
        }
      `
    },
    {
      name: 'readWriteFor',
      type: 'UserFlowAccess',
      args: 'long userId',
      javaCode: `
        UserFlowAccess access = new UserFlowAccess();
        access.setUserId(userId);
        access.setAccessLevel(FlowAccess.PUBLIC_RW);
        return access;
      `
    },
    {
      name: 'flow',
      type: 'Flow',
      args: 'FlowAccess accessLevel',
      javaCode: `
        Flow f = new Flow();
        f.setName("FlowAuthorizationTest");
        f.setCreatedBy(CREATOR_ID);
        f.setAccessLevel(accessLevel);
        return f;
      `
    }
  ]
});
