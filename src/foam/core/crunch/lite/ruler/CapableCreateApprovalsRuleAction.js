/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.lite.ruler',
  name: 'CapableCreateApprovalsRuleAction',

  documentation: `
    To create approvals requests specifically for Capable Payloads since they are nested within an
    actual Capable object
  `,

  javaImports: [
    'foam.lang.ContextAwareAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.dao.ArraySink',
    'foam.comics.v2.userfeedback.UserFeedback',
    'foam.comics.v2.userfeedback.UserFeedbackException',
    'foam.comics.v2.userfeedback.UserFeedbackStatus',
    'static foam.i18n.TranslationService.t',
    'foam.core.approval.Approvable',
    'foam.core.approval.ApprovalRequest',
    'foam.core.approval.ApprovalStatus',
    'foam.core.dao.Operation',
    'foam.core.auth.Subject',
    'foam.core.auth.User',
    'foam.core.crunch.Capability',
    'foam.core.crunch.lite.Capable',
    'foam.core.crunch.CapabilityJunctionPayload',
    'foam.core.logger.Logger',
    'foam.util.SafetyUtil',

    'java.util.ArrayList',
    'java.util.List',
    'java.util.Map'
  ],

  implements: ['foam.core.ruler.RuleAction'],

  properties: [
    {
      class: 'String',
      name: 'daoToReput',
      required: true
    },
    {
      class: 'String',
      name: 'groupToNotify',
      value: 'fraud-ops'
    },
    {
      class: 'StringArray',
      name: 'additionalGroupsToNotify'
    }
  ],

  messages: [
    { name: 'REQUEST_SEND_MSG', message: 'An approval request has been sent out' },
    { name: 'FOR', message: ' for ' }
  ],

  methods: [
    {
      name: 'decorateApprovalRequest',
      documentation: `
        For further tweaks needed to be done to the approval request, the default is to not add anything
      `,
      type: 'ApprovalRequest',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'request', type: 'ApprovalRequest' },
        { name: 'obj', type: 'FObject' },
        { name: 'capablePayloadObj', type: 'CapabilityJunctionPayload' }
      ],
      javaCode: `
        return request;
      `
    },
    {
      name: 'applyAction',
      javaCode: `
        User user = ((Subject) x.get("subject")).getUser();

        Logger logger = (Logger) x.get("logger");

        FObject clonedObj = obj.fclone();

        Capable capableObj = (Capable) clonedObj;

        if (
          String.valueOf(obj.getProperty("id")) == null ||
          SafetyUtil.isEmpty(String.valueOf(capableObj.getDAOKey()))
        ){
          logger.error("Missing id and/or DAOKey from Capable object");
          throw new RuntimeException("Missing id and/or DAOKey from Capable object");
        }


        agency.submit(x, new ContextAwareAgent() {

          @Override
          public void execute(X x) {
            for ( CapabilityJunctionPayload capablePayload : capableObj.getCapablePayloads() ){

              DAO capabilityDAO = (DAO) x.get("capabilityDAO");
              Capability capability = (Capability) capabilityDAO.find(capablePayload.getCapability());

              if ( ! capability.getReviewRequired() ) {
                continue;
              }

              DAO approvalRequestDAO = (DAO) getX().get("approvalRequestDAO");
              DAO approvableDAO = (DAO) getX().get("approvableDAO");

              Operation operation = Operation.CREATE;

              String hashedId = new StringBuilder("d")
                .append(capableObj.getDAOKey())
                .append(":o")
                .append(String.valueOf(obj.getProperty("id")))
                .append(":c")
                .append(capability.getId())
                .toString();

              List approvablesPending = ((ArraySink) approvableDAO
                .where(foam.mlang.MLang.AND(
                  foam.mlang.MLang.EQ(Approvable.LOOKUP_ID, hashedId),
                  foam.mlang.MLang.EQ(Approvable.STATUS, ApprovalStatus.REQUESTED)
                )).inX(getX()).select(new ArraySink())).getArray();

              if ( approvablesPending.size() > 0 ){
                logger.warning("Approvable already  exists for: " + hashedId);
                // TODO: throw an error once we add the paymentId checks as this is supposed  to be  unexpected
                // but because no paymentid check, then we end up in  an infinite loop just need to return
                return;
              }

              try {
                FObject objectToDiffAgainst = (FObject) capablePayload.getClassInfo().newInstance();

                Map propertiesToApprove = objectToDiffAgainst.diff(capablePayload);

                Approvable approvable = (Approvable) approvableDAO.put_(getX(), new Approvable.Builder(getX())
                  .setLookupId(hashedId)
                  .setDaoKey(capableObj.getDAOKey())
                  .setServerDaoKey(capableObj.getDAOKey())
                  .setStatus(ApprovalStatus.REQUESTED)
                  .setObjId(String.valueOf(obj.getProperty("id")))
                  .setOperation(operation)
                  .setOf(capablePayload.getClassInfo())
                  .setIsUsingNestedJournal(true)
                  .setPropertiesToUpdate(propertiesToApprove).build());

                String capName = t(x, capability.getId() + ".name", capability.getName());
                String objName = t(x, obj.getClass().getName() + ".name", obj.getClassInfo().getSimpleName());

                ApprovalRequest approvalRequest = new ApprovalRequest.Builder(getX())
                  .setDaoKey("approvableDAO")
                  .setObjId(approvable.getId())
                  .setOperation(operation)
                  .setCreatedFor(user.getId())
                  .setGroup(getGroupToNotify())
                  .setAdditionalGroups(getAdditionalGroupsToNotify())
                  .setClassification("capable-created-approval")
                  .setStatus(ApprovalStatus.REQUESTED).build();

                approvalRequest = decorateApprovalRequest(x, approvalRequest, obj, capablePayload);

                approvalRequestDAO.put_(getX(), approvalRequest);
              } catch (Exception e) {
                foam.core.logger.Loggers.logger(x, this).warning(e);
                throw new RuntimeException(e.getMessage());
              }
            }

            // everything at this point  is either PENDING or GRANTED we need to reput
            if ( ! clonedObj.equals(obj) ){
              DAO daoToReput = (DAO) x.get(getDaoToReput());

              daoToReput.put(clonedObj);
            }
          }

        }, "Sent out approval requests for required capable payloads and granted the others");
      `
    }
  ]
});
