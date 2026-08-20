/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.license',
  name: 'LicenseRuleAction',
  documentation: `
    RuleAction that checks if the targetDAO has a License configuration in the licenseDAO
    and, if it does, monitors puts and removes from the targetDAO to keep track of whether
    or not the targetDAO is in compliance with its License.
    (Count of "active" objects < License.quota)
  `,
});