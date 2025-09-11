/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.lite.ruler',
  name: 'CapablePayloadApprovableRuleAction',

  documentation: `
    Handles fulfilment of an approved approvable for a capable payload. Where the capable payload gets copied from the related approvable and
    saves onto the Capable.CapablePayloads object itself.
  `,

  javaImports: [
    'foam.lang.ContextAwareAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.auth.User',
    'foam.core.approval.Approvable',
    'foam.core.crunch.lite.Capable',
    'foam.core.crunch.CapabilityJunctionPayload',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.approval.ApprovalStatus',
    'foam.core.dao.Operation',
    'foam.core.auth.Subject',
    'java.util.Map'
  ],

  implements: ['foam.core.ruler.RuleAction'],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        agency.submit(x, new ContextAwareAgent() {

          @Override
          public void execute(X x) {
            Approvable approvable = (Approvable) obj;
            DAO dao = (DAO) getX().get(approvable.getServerDaoKey());

            FObject objectToReput = dao.find(approvable.getObjId()).fclone();

            Capable capableObjectToReput = (Capable) objectToReput;

            DAO capablePayloadDAO = capableObjectToReput.getCapablePayloadDAO(x);

            if ( approvable.getOperation() == Operation.CREATE ){
              try {
                CapabilityJunctionPayload capablePayloadToUpdate = (CapabilityJunctionPayload)
                  CapabilityJunctionPayload.getOwnClassInfo().newInstance();

                Map propsToUpdate = approvable.getPropertiesToUpdate();

                for ( Object propName : propsToUpdate.keySet() ){
                  String propNameString = (String) propName;
                  capablePayloadToUpdate.setProperty(propNameString,propsToUpdate.get(propNameString));
                }

                CapabilityJunctionStatus statusToSet = approvable.getStatus() == ApprovalStatus.APPROVED
                  ? CapabilityJunctionStatus.APPROVED
                  : CapabilityJunctionStatus.REJECTED;

                capablePayloadToUpdate.setStatus(statusToSet);
                capablePayloadToUpdate.setHasSafeStatus(true);

                // first update the object's capable payloads
                capablePayloadDAO.put(capablePayloadToUpdate);

                // then reput the actual capable object into it's dao
                dao.put(objectToReput);
              } catch ( Exception e ){
                throw new RuntimeException(e);
              }
            } else {
              throw new RuntimeException("Unsupported approvable operation.");
            }
          }
        }, "Updated the payload based on an approved approvable");
      `
    }
  ]
});
