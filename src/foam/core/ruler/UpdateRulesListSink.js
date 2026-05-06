/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ruler',
  name: 'UpdateRulesListSink',
  extends: 'foam.dao.AbstractSink',

  documentation: 'Updates rules list of RulerDAO.',

  javaImports: [
    'foam.dao.ArraySink',
    'foam.mlang.order.Desc',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.GroupBy',
    'java.util.Collections',
    'java.util.List',
    'java.util.Map'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.ruler.RulerDAO',
      name: 'dao'
    }
  ],

  methods: [
    {
      name: 'put',
      javaCode: `
        Rule rule = (Rule) obj;
        String ruleGroup = rule.getRuleGroup();
        var rulesList = dao_.getRulesList();

        // STEP 1 — Evict any existing entry for this rule from every
        // bucket and every group. Bucket membership is determined by
        // (operation, after, async); group membership by ruleGroup. Any
        // of these can change on a put, so a sweep is the only way to
        // keep the cache consistent. This also handles enabled=false,
        // lifecycleState=DELETED, and rules whose daoKey moved away.
        Rule cached = null;
        for ( Object key : rulesList.keySet() ) {
          var groupBy = rulesList.get(key);
          for ( Object groupKey : groupBy.getGroupKeys() ) {
            List<Rule> rules = ((ArraySink) groupBy.getGroups().get(groupKey)).getArray();
            Rule existing = Rule.findById(rules, rule.getId());
            if ( existing != null ) {
              rules.remove(existing);
              if ( cached == null ) cached = existing;
            }
          }
        }

        // STEP 2 — If the rule no longer belongs to this DAO, eviction
        // is sufficient.
        if ( ! rule.getDaoKey().equals(dao_.getDaoKey()) ) {
          return;
        }

        // STEP 3 — If the rule is disabled or soft-deleted, do not re-add.
        if ( ! rule.getEnabled() || rule.getLifecycleState() == foam.core.auth.LifecycleState.DELETED ) {
          return;
        }

        // STEP 4 — Re-add the rule into every bucket whose predicate
        // matches its (now current) operation/after/async combination,
        // and into the group named by its (now current) ruleGroup.
        rule.setX(getX());
        Rule effective = cached != null ? cached.updateRule(rule) : rule;
        for ( Object key : rulesList.keySet() ) {
          if ( ((Predicate) key).f(obj) ) {
            var groupBy = rulesList.get(key);
            if ( groupBy.getGroupKeys().contains(ruleGroup) ) {
              List<Rule> rules = ((ArraySink) groupBy.getGroups().get(ruleGroup)).getArray();
              rules.add(effective);
              Collections.sort(rules, new Desc(Rule.PRIORITY));
            } else {
              groupBy.putInGroup_(sub, ruleGroup, obj);
            }
            dao_.updateRuleGroups((Predicate) key);
          }
        }
      `
    },
    {
      name: 'remove',
      javaCode: `
        Rule rule = (Rule) obj;
        if ( ! rule.getDaoKey().equals(dao_.getDaoKey()) ) {
          return;
        }

        var rulesList = dao_.getRulesList();
        String ruleGroup = rule.getRuleGroup();
        for ( Object key : rulesList.keySet() ) {
          if ( ((Predicate) key).f(obj) ) {
            var groupBy = rulesList.get(key);
            if ( groupBy.getGroupKeys().contains(ruleGroup) ) {
              List<Rule> rules = ((ArraySink) groupBy.getGroups().get(ruleGroup)).getArray();
              Rule foundRule = Rule.findById(rules, rule.getId());
              if ( foundRule != null ) {
                rules.remove(foundRule);
                dao_.updateRuleGroups((Predicate) key);
              }
            }
          }
        }
      `
    }
  ]
});
