/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.ruler',
  name: 'ExpireOldMinMaxHierarchy',
  documentation: `
    Rule action that invalidates any choice hierarchies for MinMax choices that were deselected.
    Only a RuleAction as this is rarely desired behaviour but can be ugraded to MinMaxCapability property if required.
  `,

  implements: [
    'foam.core.ruler.RuleAction'
  ],

  javaImports: [
    'java.util.Arrays',
    'java.util.List',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.core.crunch.CrunchService',
    'foam.core.crunch.Capability',
    'foam.core.crunch.CapabilityJunctionStatus',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.core.crunch.MinMaxCapabilityData',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        final var clsName = getClass().getSimpleName();
        X systemX = ruler.getX();
        agency.submit(x, new ContextAgent() {
          @Override
          public void execute(X x) {
            Logger logger = (Logger) x.get("logger");
            logger.debug("ExpireOldMinMaxHierarchy", "start!!!!!");
            var ucj    = (UserCapabilityJunction) obj;
            var oldUCJ = (UserCapabilityJunction) oldObj;

            // Logger logger = (Logger) x.get("logger");
            logger.debug("ExpireOldMinMaxHierarchy", "start", ucj);

            CrunchService crunchService = (CrunchService) x.get("crunchService");
            String[] oldSelectedData = (String[]) ((MinMaxCapabilityData) oldUCJ.getData()).getSelectedData();
            List<String> newSelectedData = Arrays.asList((String[]) ((MinMaxCapabilityData) ucj.getData()).getSelectedData() );

            String[] oldCapas = Arrays.stream(oldSelectedData)
                                      .filter(el -> ! newSelectedData.contains(el))
                                      .toArray(String[]::new);
            Loggers.logger(x, this, clsName).warning("Removing hierarchy for", ucj.getTargetId(), "ucj",  oldCapas);

            for ( String s : oldCapas ) {
              List<Capability> capabilitiesToRemove = (List<Capability>) crunchService.getCapabilityPath(x, s, false, true);
              for ( Capability capa : capabilitiesToRemove ) {
                String capabilityId = (String) capa.getId();
                try {
                  Loggers.logger(x, this, clsName).warning("Expiring Capa", capa);
                  UserCapabilityJunction ucjToInvalidate = crunchService.getJunction(x, capabilityId);
                  if ( ucjToInvalidate != null ) {
                    // Do this in systemX since the user doesnt not have permission to reset UCJs
                    crunchService.resetJunctionData(systemX, ucjToInvalidate.getId());
                  }
                } catch (Exception e) {
                  Loggers.logger(x, this, clsName).error("Expiry failed", ucj.getTargetId(), "error:",  e);
                }
              }
            }
            logger.debug("ExpireOldMinMaxHierarchy", "end", ucj);
          }
        }, "Expire hierarchies for any minmax choices removed from new ucj");
      `
    }
  ]
});
