/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.mlang',
  name: 'PropertyAuthorizable',

  documentation: `Implemented by anything a client can hand a DAO that reads
    property values: predicates, expressions, properties and comparators.
    PermissionedPropertyDAO calls authorize() before a select so that a
    query cannot read a property the user may not see. Without it,
    WHERE salary > 50000 run repeatedly would binary-search a hidden salary.`,

  methods: [
    {
      name: 'authorize',
      flags: [ 'java' ],
      type: 'Void',
      args: [
        {
          name: 'x',
          type: 'Context'
        },
        {
          documentation: `The class the query will be applied to. Most
            implementations ignore it, but string queries such as MQLExpr,
            AQLExpr and FScript only know which properties they read once
            parsed against a class.`,
          name: 'of',
          type: 'foam.lang.ClassInfo'
        }
      ]
    }
  ]
});
