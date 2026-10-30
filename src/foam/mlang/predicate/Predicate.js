/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.INTERFACE({
  package: 'foam.mlang.predicate',
  name: 'Predicate',

  implements: [
    'foam.dao.SQLStatement',
    'foam.mlang.PropertyAuthorizable'
  ],

  documentation: 'Predicate interface: f(obj) -> boolean.',

  methods: [
    {
      name: 'f',
      type: 'Boolean',
      args: [
        {
          name: 'obj',
          type: 'Any'
        }
      ]
    },
    {
      name: 'partialEval',
      type: 'foam.mlang.predicate.Predicate',
    },
    {
      name: 'toIndex',
      flags: ['js'],
      args: [
        {
          name: 'tail',
          type: 'foam.dao.index.Index'
        }
      ],
      type: 'foam.dao.index.Index'
    },
    {
      name: 'toDisjunctiveNormalForm',
      flags: ['js', 'java'],
      javaSupport: false,
      type: 'foam.mlang.predicate.Predicate',
    }
  ]
});
