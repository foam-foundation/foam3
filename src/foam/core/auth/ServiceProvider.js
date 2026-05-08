/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'ServiceProvider',
  extends: 'foam.core.crunch.Capability',

  documentation: 'Service Provider Capability',

  javaImports: [
    'foam.lang.X',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.mlang.predicate.AbstractPredicate',
    'foam.mlang.predicate.Predicate',
    'foam.core.auth.Subject',
    'foam.core.crunch.Capability',
    'foam.core.crunch.CapabilityCapabilityJunction',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.CrunchService',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.core.logger.Logger',
    'java.util.ArrayList',
    'java.util.List',
    'java.util.stream.Collectors',
    'static foam.mlang.MLang.*'
  ],

  properties: [
    {
      class: 'String',
      name: 'id',
      createVisibility: 'RW',
      updateVisibility: 'RW',
      documentation: 'Service provider name',
      validationPredicates: [
        {
          args: ['id'],
          query: 'id~/^[a-z0-9]+([.-][a-z0-9]+)*$/',
          errorString: 'Invalid id format.'
        }
      ]
    },
    {
      class: 'String',
      name: 'name',
      javaFactory: `
        return "*".equals(getId()) ? "Global Service Provider Capability" :
          getId().substring(0, 1).toUpperCase() + getId().substring(1) + " Service Provider Capability";
      `
    },
    {
      name: 'inherentPermissions',
      javaGetter: `return new String[] {
        "serviceprovider.read." + getId(),
        "serviceproviderdao.read." + getId()
      };`,
      factory: function() {
        return [
          'serviceprovider.read.' + this.id,
          'serviceproviderdao.read.' + this.id
        ];
      },
      documentation: 'Service provider must have "serviceprovider.read.<SPID>" inherent permission.',
    },
    {
      class: 'Long',
      name: 'anonymousUser',
      documentation: 'Reference to anonymous user relative to spid. See the **authorizeAnonymous** method in AuthService.js for further documentation.'
    }
  ],

  methods: [
    {
      name: 'grantsPermission',
      javaCode: `
        return super.grantsPermission(x, permission) || prerequisiteImplies(x, permission);
      `
    },
    {
      name: 'setupSpid',
      args: [
        { name: 'x',    javaType: 'foam.lang.X' },
        { name: 'user', javaType: 'foam.core.auth.User' }
      ],
      documentation: `
        Method responsible for setting up a user's ServiceProvider capability by finding
        the prerequisites of the ServiceProvider and granting those along with it
      `,
      javaCode: `
        Logger logger = (Logger) x.get("logger");
        DAO userCapabilityJunctionDAO = (DAO) x.get("bareUserCapabilityJunctionDAO");
        CrunchService crunchService = (CrunchService) x.get("crunchService");

        // get grantPath of the service provider capability
        List<Capability> grantPath = (List<Capability>) crunchService.getCapabilityPath(x, getId(), false, true);

        try {
          // for each capability in the grantPath of the spid capability,
          // find the ucj and update its status to granted, or create a ucj none found

          UserCapabilityJunction ucj;
          Subject subject = new Subject(user);
          for ( Capability capability : grantPath ) {
            ucj = crunchService.updateUserJunction(x, subject, capability.getId(), null, CapabilityJunctionStatus.GRANTED);
            if ( ucj == null || ucj.getStatus() != CapabilityJunctionStatus.GRANTED )
              throw new RuntimeException("Error setting up UserCapabilityJunction for user: " + user.getId() + " and spid: " + getId());
          }
        } catch (Exception e) {
          logger.error(e);
        }
      `
    },
    {
      name: 'removeSpid',
      args: [
        { name: 'x',    javaType: 'foam.lang.X' },
        { name: 'user', javaType: 'foam.core.auth.User' }
      ],
      documentation: `
        Method used for removing a user's old ServiceProvider capability and any capability that is a part
        of that capability through prerequisite junctions.
        Called before a user is assigned a new ServiceProvider capability
      `,
      javaCode: `
        CrunchService crunchService             = (CrunchService) x.get("crunchService");
        DAO           userCapabilityJunctionDAO = (DAO) x.get("bareUserCapabilityJunctionDAO");

        // find list of old spids to remove from user
        AbstractPredicate serviceProviderTargetPredicate = new AbstractPredicate(x) {
          @Override
          public boolean f(Object obj) {
            UserCapabilityJunction ucJunction = (UserCapabilityJunction) obj;
            Capability c = (Capability) ucJunction.findTargetId(x);
            return c instanceof ServiceProvider;
          }
        };
        List<UserCapabilityJunction> spidsToRemove = (ArrayList<UserCapabilityJunction>) ((ArraySink) userCapabilityJunctionDAO
          .where(AND(
            EQ(UserCapabilityJunction.SOURCE_ID, user.getId()),
            NEQ(UserCapabilityJunction.TARGET_ID, getId()),
            serviceProviderTargetPredicate
          )).select(new ArraySink())).getArray();

        // for each old spid, get its capabilityPath, and remove all ucjs on the capabilityPath

        for ( UserCapabilityJunction sp : spidsToRemove ) {
          List<Capability> capabilitiesToRemove = (List<Capability>) crunchService.getCapabilityPath(x, sp.getTargetId(), false, true);
          List<String> targetIdsToRemove = capabilitiesToRemove.stream().map(c -> c.getId()).collect(Collectors.toList());

          userCapabilityJunctionDAO.where(AND(
            EQ(UserCapabilityJunction.SOURCE_ID, user.getId()),
            IN(UserCapabilityJunction.TARGET_ID, targetIdsToRemove)
          )).removeAll();
          invalidateDependents(x, user, sp.getTargetId());
        }
      `
    },
    {
      name: 'invalidateDependents',
      args: [
        { name: 'x',    javaType: 'foam.lang.X' },
        { name: 'user', javaType: 'foam.core.auth.User' },
        { name: 'spid', javaType: 'String' }
      ],
      documentation: `
        Reput dependents of serviceprovider to invalidate them since serviceprovider was
        removed via bareUserCapabilityJunctionDAO
      `,
      javaCode: `
        CrunchService crunchService = (CrunchService) x.get("crunchService");
        DAO prereqDAO = (DAO) x.get("prerequisiteCapabilityJunctionDAO");
        Subject subject = new Subject(user);

        List<CapabilityCapabilityJunction> ccjs = ((ArraySink) prereqDAO
          .where(EQ(CapabilityCapabilityJunction.TARGET_ID, spid))
          .select(new ArraySink()))
          .getArray();

        for ( CapabilityCapabilityJunction ccj : ccjs ) {
          crunchService.updateUserJunction(x, subject, ccj.getSourceId(), null, null);
        }
      `
    }
  ]
});
