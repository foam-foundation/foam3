/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.core.ruler;

import foam.lang.ContextAwareSupport;
import foam.lang.X;
import foam.dao.ArraySink;
import foam.dao.DAO;
import foam.core.auth.AuthService;
import foam.core.auth.AuthorizationException;
import foam.core.dao.Operation;
import foam.core.logger.Logger;
import foam.core.pm.PM;
import java.util.List;

/**
 * Simple implementation of RuleRefreshService that refreshes all records
 * in a rule's target DAO by re-putting them to trigger onCreate rules.
 */
public class SimpleRuleRefreshService
  extends ContextAwareSupport
  implements RuleRefreshService
{

  public SimpleRuleRefreshService(X x) {
    setX(x);
  }

  @Override
  public RuleRefreshResult refreshDAO(String ruleId) {
    X x = getX();
    Logger logger = (Logger) x.get("logger");
    PM pm = PM.create(x, this.getClass(), "refreshDAO");

    RuleRefreshResult result = new RuleRefreshResult();
    result.setRuleId(ruleId);

    long startTime = System.currentTimeMillis();

    try {
      // Check permission
      AuthService auth = (AuthService) x.get("auth");
      if ( ! auth.check(x, "rule.refreshDAO") ) {
        throw new AuthorizationException("You do not have permission to refresh DAO data.");
      }

      // Find the rule
      DAO ruleDAO = (DAO) x.get("ruleDAO");
      Rule rule = (Rule) ruleDAO.find(ruleId);

      if ( rule == null ) {
        throw new RuntimeException("Rule not found: " + ruleId);
      }

      if ( ! rule.getEnabled() ) {
        throw new RuntimeException("Rule is not enabled. Enable the rule first before refreshing.");
      }

      // Validate operation type - only UPDATE or CREATE_OR_UPDATE will be triggered by re-putting
      Operation op = rule.getOperation();
      if ( op != Operation.UPDATE && op != Operation.CREATE_OR_UPDATE ) {
        throw new RuntimeException("DAO refresh is only supported for UPDATE or CREATE_OR_UPDATE rules. This rule has operation '" + op.getLabel() + "' which will not be triggered by re-putting existing records.");
      }

      String daoKey = rule.getDaoKey();
      if ( daoKey == null || daoKey.isEmpty() ) {
        throw new RuntimeException("Rule does not have a DAO key configured: " + ruleId);
      }

      result.setDaoKey(daoKey);

      // Get the target DAO
      DAO targetDAO = (DAO) x.get(daoKey);
      if ( targetDAO == null ) {
        throw new RuntimeException("DAO not found: " + daoKey);
      }

      logger.info("Starting DAO refresh for rule: " + ruleId + ", DAO: " + daoKey);

      // Select all records and re-put them
      ArraySink sink = (ArraySink) targetDAO.select(new ArraySink());
      List records = sink.getArray();

      long processedCount = 0;
      long updatedCount = 0;
      long failedCount = 0;

      for ( Object record : records ) {
        try {
          // Clone and re-put to trigger rules
          foam.lang.FObject original = (foam.lang.FObject) record;
          foam.lang.FObject clone = original.fclone();
          foam.lang.FObject updated = (foam.lang.FObject) targetDAO.put(clone);
          processedCount++;

          // Check if the record was actually modified
          if ( ! original.equals(updated) ) {
            updatedCount++;
          }
        } catch ( Exception e ) {
          failedCount++;
          logger.warning("Failed to refresh record in " + daoKey + ": " + e.getMessage());
        }
      }

      result.setProcessedCount(processedCount);
      result.setUpdatedCount(updatedCount);
      result.setFailedCount(failedCount);
      result.setSuccess(failedCount == 0);
      result.setDuration(System.currentTimeMillis() - startTime);

      if ( failedCount > 0 ) {
        result.setErrorMessage(failedCount + " records failed to process");
      }

      logger.info("DAO refresh completed for rule: " + ruleId +
                  ", processed: " + processedCount +
                  ", updated: " + updatedCount +
                  ", failed: " + failedCount +
                  ", duration: " + result.getDuration() + "ms");

    } catch ( Exception e ) {
      result.setSuccess(false);
      result.setErrorMessage(e.getMessage());
      result.setDuration(System.currentTimeMillis() - startTime);
      logger.error("DAO refresh failed for rule: " + ruleId, e);
      throw new RuntimeException("DAO refresh failed: " + e.getMessage(), e);
    } finally {
      pm.log(x);
    }

    return result;
  }
}
