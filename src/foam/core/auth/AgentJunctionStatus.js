/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.auth',
  name: 'AgentJunctionStatus',
  documentation: 'Describes the status between agent and entity on their junction.',
   values: [
    {
      name: 'ACTIVE',
      label: 'Active',
      color: '$statusSuccessText',
      background: '$statusSuccessBackground',
      documentation: 'Junction is satisfied and agent may act as entity.'
    },
    {
      name: 'DISABLED',
      label: 'Disabled',
      color: '$statusDangerText',
      background: '$statusDangerBackground',
      documentation: 'Junction is unsatisfied disabling agent from acting as entity.'
    },
    {
      name: 'INVITED',
      label: 'Invited',
      color: '$warn700',
      background: '$warn500',
      documentation: 'The person has been invited to join the business.'
    }
  ]
});
