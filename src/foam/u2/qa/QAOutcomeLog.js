/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.qa',
  name: 'QAOutcomeLog',

  implements: [
    'foam.core.auth.CreatedAware'
  ],

  properties: [
    {
      class: 'String',
      name: 'id',
      factory: function() { return foam.uuid.randomGUID(); },
      javaFactory: 'return java.util.UUID.randomUUID().toString();'
    },
    {
      class: 'FObjectProperty',
      name: 'questionnaire'
    },
    {
      class: 'Enum',
      of: 'foam.log.LogLevel',
      name: 'logLevel'
    }
  ]
});
