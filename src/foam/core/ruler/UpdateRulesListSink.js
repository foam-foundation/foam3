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
        if ( ! rule.getDaoKey().equals(dao_.getDaoKey()) ) {
          return;
        }

        var rulesList = dao_.getRulesList();
        String ruleGroup = rule.getRuleGroup();

        // Evict any pre-existing entry for this rule across every bucket
        // and group. Bucket/group membership can change on a put
        // (operation, after, async, or ruleGroup), so the rule may no
        // longer belong where it currently sits.
        for ( Object key : rulesList.keySet() ) {
          var groupBy = rulesList.get(key);
          for ( Object groupKey : groupBy.getGroupKeys() ) {
            List<Rule> rules = ((ArraySink) groupBy.getGroups().get(groupKey)).getArray();
            Rule existing = Rule.findById(rules, rule.getId());
            if ( existing != null ) rules.remove(existing);
          }
        }

        if ( ! rule.getEnabled() || rule.getLifecycleState() == foam.core.auth.LifecycleState.DELETED ) {
          return;
        }

        for ( Object key : rulesList.keySet() ) {
          if ( ((Predicate) key).f(obj) ) {
            rule.setX(getX());
            var groupBy = rulesList.get(key);
            if ( groupBy.getGroupKeys().contains(ruleGroup) ) {
              List<Rule> rules = ((ArraySink) groupBy.getGroups().get(ruleGroup)).getArray();
              rules.add(rule);
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
