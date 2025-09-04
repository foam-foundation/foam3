/**
 * Copyright
 * @license 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.security.test',
  name: 'SecurityAuditTest',
  extends: 'foam.core.test.Test',

  javaImports: [
    'foam.core.auth.Group',
    'foam.core.boot.CSpec',
    'foam.core.crunch.Capability',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.dao.ArraySink',
    'foam.lang.X',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'foam.util.SafetyUtil',
    'java.util.Arrays',
    'java.util.ArrayList',
    'java.util.List'
  ],

  properties: [
    {
      name: 'ignoreGroups',
      class: 'StringArray',
      javaFactory: `
        return new String[] {"admin", "system"};
      `
    },
    {
      name: 'ignoreServices',
      class: 'StringArray',
      javaFactory: `
        return new String[] {};
      `
    }
  ],

  methods: [
    {
      name: 'setup',
      args: 'X x',
      javaCode: `
        x.get("http");
      `
    },
    {
      name: 'runTest',
      javaCode: `
      setup(x);
      Logger logger = Loggers.logger(x, this);

      List<String> ignoreServices = Arrays.asList(getIgnoreServices());

      List<CSpec> cspecs = (List) ((ArraySink) ((DAO) x.get("cSpecDAO"))
        .where(
          AND(
            EQ(CSpec.ENABLED, true),
            EQ(CSpec.SERVE, true)
          )
        )
        .select(new ArraySink())).getArray();
      for ( CSpec spec : cspecs ) {
        if ( ignoreServices.contains(spec.getName()) )
          continue;

        if ( spec.getName().indexOf("DAO") == -1 )
          continue;

        DAO dao = (DAO) x.get(spec.getName());
        var authorizer   = "";
        try {
          Object result = dao.cmd("AUTHORIZER?");
          if ( result != null ) {
            authorizer = result.toString();
          }
        } catch ( Throwable t ) {
          // nop
        }
        var readOnly = isDAO(x, dao, "foam.dao.ReadOnlyDAO");
        var nullDAO = isDAO(x, dao, "foam.dao.NullDAO");

        var permissioned = isDAO(x, dao, "foam.core.auth.PermissionedPropertyDAO");
        var spidAware    = isDAO(x, dao, "foam.core.auth.ServiceProviderAwareDAO");

        String serviceName = "service."+spec.getName();
        java.security.Permission permission = new javax.security.auth.AuthPermission(serviceName);
        List implies = new ArrayList();
        List<String> ignore = Arrays.asList(getIgnoreGroups());
        List<Group> groups = (List) ((ArraySink) ((DAO) x.get("groupDAO")).select(new ArraySink())).getArray();
        for ( Group group : groups ) {
          if ( ignore.contains(group.getId()) )
            continue;
          if ( group.implies(x, permission) )
            implies.add(group.getId());
        }
        List grants = new ArrayList();
        List<Capability> caps = (List) ((ArraySink) ((DAO) x.get("capabilityDAO")).select(new ArraySink())).getArray();
        for ( Capability cap : caps ) {
          for ( String grant : cap.getPermissionsGranted() ) {
            if ( grant.equals(serviceName) )
              grants.add(cap.getName());
          }
        }

        // test
        if ( SafetyUtil.isEmpty(authorizer) &&
             ! spec.getAuthenticate() && 
             ! readOnly &&
             ! nullDAO ) {
          test ( false, "DAO misconfigured "+spec.getName()+" - no authorizer && not readOnlyDAO && not nullDAO");
        } else if ( SafetyUtil.isEmpty(authorizer) &&
             implies.size() > 0 &&
             ! readOnly &&
             ! nullDAO &&
             SafetyUtil.isEmpty(spec.getAuthNotes()) ) {
          test ( false, "DAO misconfigured "+spec.getName()+" - no authorizer && implies && not readOnlyDAO && not nullDAO && no auth notes");
        }
      }

      teardown(x);
      `
    },
    {
      name: 'isDAO',
      args: 'X x, DAO dao, String name',
      // args: 'X x, DIG dao, String name',
      type: 'Boolean',
      javaCode: `
        try {
          Object result = dao.cmd("CLASS? "+name);
          if ( result != null && result instanceof Boolean ) {
            return ((Boolean) result).booleanValue();
          }
        } catch ( Throwable t ) {
          // nop
        }
        return false;
      `
    },
    {
      name: 'teardown',
      args: 'X x',
      javaCode: `
        // nop
      `
    },
  ]
});
