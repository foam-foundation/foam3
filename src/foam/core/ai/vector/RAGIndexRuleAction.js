/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.vector',
  name: 'RAGIndexRuleAction',
  implements: [ 'foam.core.ruler.RuleAction' ],

  documentation: `
    Keeps Ask AI's index in step with a DAO: a saved record that matches
    predicate is re-embedded, and a removed record, or one saved that no longer
    matches (a doc that lost its knowledge keyword), leaves the index. The
    predicate is the action's, not the rule's: a rule predicate sees only the
    saved copy, so it could not catch a record that stopped matching. Set the
    rule async, so a save does not wait for the embedding call.
  `,

  javaImports: [
    'foam.core.dao.Operation',
    'foam.lang.X'
  ],

  properties: [
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'predicate',
      documentation: 'The records to index, e.g. flows whose keywords hold knowledge.'
    }
  ],

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        X sx = ruler.getX();
        if ( rule.getOperation() == Operation.REMOVE || ! getPredicate().f(obj) ) {
          new RAGIndexer().remove(sx, rule.getDaoKey(), String.valueOf(obj.getProperty("id")));
          return;
        }
        // A save that leaves the text as it was (a moved block, a renamed tab)
        // costs nothing: the indexer finds the same sourceHash and stops.
        new RAGIndexer().index(sx, rule.getDaoKey(), obj);
      `
    }
  ]
});
