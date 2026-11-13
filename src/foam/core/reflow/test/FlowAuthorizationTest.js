/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.test',
  name: 'FlowAuthorizationTest',
  extends: 'foam.core.test.Test',

  documentation: `A save must pass the write rules of the stored flow and of the copy being
    saved. Runs the Flow authorize methods directly, as a user who is not the creator and holds
    no permissions, so only the access rules decide.`,

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
          "A PUBLIC_RO flow cannot be saved back as PUBLIC_RW");

        Flow claimed = (Flow) readOnly.fclone();
        claimed.setCreatedBy(USER_ID);
        test(! canUpdate(ux, readOnly, claimed),
          "A PUBLIC_RO flow cannot be saved with createdBy set to the user");

        Flow readWrite = flow(FlowAccess.PUBLIC_RW);
        Flow locked = (Flow) readWrite.fclone();
        locked.setAccessLevel(FlowAccess.PRIVATE);
        test(! canUpdate(ux, readWrite, locked),
          "A PUBLIC_RW flow cannot be saved as PRIVATE by a user who did not create it");

        Flow edited = (Flow) readWrite.fclone();
        edited.setDescription("edited");
        test(canUpdate(ux, readWrite, edited),
          "A PUBLIC_RW flow can still be edited");

        Flow shared = flow(FlowAccess.SHARED);
        UserFlowAccess rw = new UserFlowAccess();
        rw.setUserId(USER_ID);
        rw.setAccessLevel(FlowAccess.PUBLIC_RW);
        shared.setSpecifiedUserAccess(new UserFlowAccess[] { rw });
        Flow sharedEdit = (Flow) shared.fclone();
        sharedEdit.setDescription("edited");
        test(canUpdate(ux, shared, sharedEdit),
          "A SHARED flow can be edited by a user listed with PUBLIC_RW");

        Flow own = flow(FlowAccess.PRIVATE);
        own.setCreatedBy(USER_ID);
        Flow ownEdit = (Flow) own.fclone();
        ownEdit.setAccessLevel(FlowAccess.PUBLIC_RO);
        test(canUpdate(ux, own, ownEdit),
          "The creator can still change their own flow's access");

        boolean deleteDenied = false;
        try { readOnly.authorizeOnDelete(ux); } catch ( AuthorizationException e ) { deleteDenied = true; }
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
