/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch',
  name: 'MinMaxCapability',
  extends: 'foam.core.crunch.Capability',

  javaImports: [
    'foam.lang.X',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'java.util.Arrays',
    'java.util.List',
    'static foam.mlang.MLang.*',
    'foam.core.auth.LifecycleState',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.crunch.CrunchService',
    'foam.core.crunch.MinMaxCapabilityData',
    'foam.core.crunch.ui.MinMaxCapabilityWizardlet'
  ],

  properties: [
    {
      name: 'of',
      hidden: true,
      value: "foam.core.crunch.MinMaxCapabilityData",
      javaFactory:`
        return foam.core.crunch.MinMaxCapabilityData.getOwnClassInfo();
      `
    },
    {
      class: 'FObjectProperty',
      javaType: 'foam.core.crunch.edit.EditBehaviour',
      name: 'editBehaviour',
      javaFactory: `
        return new foam.core.crunch.edit.PermissiveEditBehaviour();
      `
    },
    {
      name: 'min',
      class: 'Int',
      value: 1
    },
    {
      name: 'max',
      class: 'Int',
      value: 0
    },
    {
      class: 'Boolean',
      name: 'goNextOnValid',
      documentation: 'Automatically go to next wizardlet when minmax is valid'
    },
    {
      class: 'Object',
      name: 'beforeWizardlet',
      documentation: `
        Defines a wizardlet used when displaying this capability on related client crunch wizards.
      `,
      factory: function() {
        return foam.core.crunch.ui.MinMaxCapabilityWizardlet.create({}, this);
      }
    },
    {
      class: 'Object',
      name: 'wizardlet',
      documentation: `
        Defines a wizardlet to display this capability in a wizard. This
        wizardlet will display after this capability's prerequisites.
      `,
      factory: function() {
        return foam.core.crunch.ui.CapabilityWizardlet.create({isVisible: false}, this);
      },
      includeInDigest: false
    },
    {
      class: 'Boolean',
      name: 'prereqStatusFromData',
      documentation: `When set the status of the UCJ associated to this capability will be determined according to it's data.selectedData property.
      As long as selected choices meet the min-max threshold, this UCJ will be granted. This is handy when trying to programatically add requirements to a hierarchy 
      where the data can force this UCJ to be ActionRequired even with a min 0`
    }
  ],

  methods: [
    {
      name: 'getPrereqsChainedStatus',
      type: 'CapabilityJunctionStatus',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'ucj', type: 'UserCapabilityJunction' }
      ],
      javaCode: `
        // Required services and DAOs
        CrunchService crunchService = (CrunchService) x.get("crunchService");
        DAO capabilityDAO = (DAO) x.get("capabilityDAO");
        Subject junctionSubject = (Subject) ucj.getSubject(x);

        // Prepare to count statuses
        int numberGranted = 0;
        int numberPending = 0;

        var ucjData = (MinMaxCapabilityData) ucj.getData();
        List<String> prereqCapabilityIds;

        if ( ( getPrereqStatusFromData() || getMin() == 0 ) && ( ucjData != null && ucjData.getSelectedData() != null && ucjData.getSelectedData().length > 0 ) ) {
          prereqCapabilityIds = Arrays.asList((String[]) ucjData.getSelectedData());
        } else {
          // Get list of prerequisite capability ids
          prereqCapabilityIds = crunchService.getPrereqs(x, getId(), ucj);
  
          // this is under the assumption that minmaxCapabilities should always have prerequisites
          // and that min is never less than 1
          if ( prereqCapabilityIds == null || prereqCapabilityIds.size() == 0 ) return CapabilityJunctionStatus.ACTION_REQUIRED;
        }

        // Count junction statuses
        for ( String capId : prereqCapabilityIds ) {
          Capability cap = (Capability) capabilityDAO.find(capId);
          if ( cap == null ||  cap.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) continue;

          X junctionSubjectContext = x.put("subject", junctionSubject);

          UserCapabilityJunction ucJunction =
            crunchService.getJunction(junctionSubjectContext, capId);
          if ( ucJunction.getStatus() == AVAILABLE ) continue;

          switch ( ucJunction.getStatus() ) {
            case GRANTED:
              numberGranted++;
              break;
            case PENDING:
            case APPROVED:
              numberPending++;
              break;
          }
        }

        var min = getMin();
        if ( ( getPrereqStatusFromData() || min == 0 ) && (ucjData != null && ucjData.getSelectedData() != null && ucjData.getSelectedData().length > 0) ) {
          min = ucjData.getSelectedData().length;
        }

        // MinMaxCapability has enough GRANTED prereqs, return GRANTED
        if ( numberGranted >= min ) {
          return CapabilityJunctionStatus.GRANTED;
        }

        // MinMaxCapability has enough PENDING prereqs, return PENDING
        if ( numberGranted + numberPending >= min ) {
          return CapabilityJunctionStatus.PENDING;
        }

        // Otherwise, default to ACTION_REQUIRED
        return CapabilityJunctionStatus.ACTION_REQUIRED;
      `
    },
    {
      name: 'maybeReopen',
      type: 'Boolean',
      args: [
        { name: 'x', javaType: 'foam.lang.X' },
        { name: 'ucj', javaType: 'foam.core.crunch.UserCapabilityJunction' }
      ],
      documentation: `
        Returns true if the number of prereqs granted but not in an reopenable state
        is less than 'min'
      `,
      javaCode: `
        if ( getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) return false;
        if ( getGrantMode() == CapabilityGrantMode.MANUAL ) return false;

        DAO capabilityDAO = (DAO) x.get("capabilityDAO");
        CrunchService crunchService = (CrunchService) x.get("crunchService");

        boolean shouldReopenTopLevel = shouldReopenUserCapabilityJunction(ucj);
        if ( shouldReopenTopLevel ) return true;

        var prereqs = crunchService.getPrereqs(x, getId(), ucj);
        if ( prereqs == null || prereqs.size() == 0 ) return false;

        int numberGrantedNotReopenable = 0;
        for ( var capId : prereqs ) {
          Capability cap = (Capability) capabilityDAO.find(capId);
          if ( cap == null ||  cap.getLifecycleState() != foam.core.auth.LifecycleState.ACTIVE ) throw new RuntimeException("Cannot find prerequisite capability");
          if ( cap.getGrantMode() == CapabilityGrantMode.MANUAL ) {
            numberGrantedNotReopenable++;
            continue;
          }
          UserCapabilityJunction prereq = crunchService.getJunction(x, capId);
          if ( prereq != null && ! cap.maybeReopen(x, prereq) )
            numberGrantedNotReopenable++;
        }
        // if there are at least min number granted not reopenable, then no need to reopen capability
        return numberGrantedNotReopenable < getMin();
      `
    },
    {
      name: 'shouldReopenUserCapabilityJunction',
      type: 'Boolean',
      args: [
        { name: 'ucj', javaType: 'foam.core.crunch.UserCapabilityJunction' }
      ],
      javaCode: `
        if ( ucj == null ) return true;
        else if ( ucj.getStatus() == CapabilityJunctionStatus.GRANTED && ucj.getIsRenewable() ) return true;
        else if ( ucj.getStatus() != CapabilityJunctionStatus.GRANTED &&
                  ucj.getStatus() != CapabilityJunctionStatus.PENDING &&
                  ucj.getStatus() != CapabilityJunctionStatus.APPROVED ) return true;
        return false;
      `
    },
    {
      name: 'getImpliedData',
      documentation: `
        If this UCJ is stored for a MinMax without a list of choices, and enough
        UCJs are present to describe a choice selection, then the
        data of the UCJ will be set to the first LIMIT(max) choices.
      `,
      args: [
        { name: 'x', javaType: 'foam.lang.X' },
        { name: 'ucj', javaType: 'foam.core.crunch.UserCapabilityJunction' }
      ],
      type: 'FObject',
      javaCode: `
        var crunchService = (CrunchService) x.get("crunchService");
        List<String> ids = crunchService.getPrereqs(x, getId(), ucj);
        var ucjDAO = (DAO) x.get("userCapabilityJunctionDAO");

        List<UserCapabilityJunction> ucjs = ((ArraySink) ucjDAO
          .where(IN(UserCapabilityJunction.TARGET_ID, ids))
          .select(new ArraySink())).getArray();

        if ( ucjs.size() < getMin() ) return null;

        var data = new MinMaxCapabilityData();

        var count = Math.min(ucjs.size(), getMax());
        String[] foundIds = new String[count];

        for ( var i = 0 ; i < count ; i++ ) {
          foundIds[i] = ucjs.get(i).getTargetId();
        }

        data.setSelectedData(foundIds);

        return data;
      `
    }
  ]
});
