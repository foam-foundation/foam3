/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ruler',
  name: 'RulerDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `
    RulerDAO selects all the rules that can be applied to specific dao depending on type of operation(create/update/remove). Selected rules are applied
    in the order specified in rule.priority until all are executed or until one of the rules forces execution to stop.
    See RulerDAOTest for examples.
  `,

  javaImports: [
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.ReadOnlyDAOContext',
    'foam.lang.X',
    'foam.dao.AbstractSink',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.mlang.order.Desc',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.GroupBy',
    'foam.core.dao.Operation',
    'foam.core.logger.Logger',
    'java.util.ArrayList',
    'java.util.concurrent.Semaphore',
    'java.util.List',
    'java.util.Map',
    'static foam.mlang.MLang.*'
  ],

  properties: [
    {
      class: 'String',
      name: 'daoKey',
      documentation: 'The dao name that rule needs to be applied on.'
    },
    {
      class: 'Object',
      name: 'lock',
      javaType: 'java.util.concurrent.Semaphore',
      javaFactory: 'return new Semaphore(1, true);'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'createBefore',
      javaFactory: `return AND(
  EQ(Rule.ASYNC, false),
  OR(
    EQ(Rule.OPERATION, Operation.CREATE),
    EQ(Rule.OPERATION, Operation.CREATE_OR_UPDATE)
  ),
  EQ(Rule.AFTER, false)
);`
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'createAfter',
      javaFactory: `return AND(
  EQ(Rule.ASYNC, false),
  OR(
    EQ(Rule.OPERATION, Operation.CREATE),
    EQ(Rule.OPERATION, Operation.CREATE_OR_UPDATE)
  ),
  EQ(Rule.AFTER, true)
);`
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'updateBefore',
      javaFactory: `return AND(
  EQ(Rule.ASYNC, false),
  OR(
    EQ(Rule.OPERATION, Operation.UPDATE),
    EQ(Rule.OPERATION, Operation.CREATE_OR_UPDATE)
  ),
  EQ(Rule.AFTER, false)
);`
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'updateAfter',
      javaFactory: `return AND(
  EQ(Rule.ASYNC, false),
  OR(
    EQ(Rule.OPERATION, Operation.UPDATE),
    EQ(Rule.OPERATION, Operation.CREATE_OR_UPDATE)
  ),
  EQ(Rule.AFTER, true)
);`
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'removeBefore',
      javaFactory: `return AND(
  EQ(Rule.ASYNC, false),
  EQ(Rule.OPERATION, Operation.REMOVE),
  EQ(Rule.AFTER, false)
);`
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'removeAfter',
      javaFactory: `return AND(
  EQ(Rule.ASYNC, false),
  EQ(Rule.OPERATION, Operation.REMOVE),
  EQ(Rule.AFTER, true)
);`
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'createAsync',
      javaFactory: `return AND(
  EQ(Rule.ASYNC, true),
  OR(
    EQ(Rule.OPERATION, Operation.CREATE),
    EQ(Rule.OPERATION, Operation.CREATE_OR_UPDATE)
  )
);`
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'updateAsync',
      javaFactory: `return AND(
  EQ(Rule.ASYNC, true),
  OR(
    EQ(Rule.OPERATION, Operation.UPDATE),
    EQ(Rule.OPERATION, Operation.CREATE_OR_UPDATE)
  )
);`
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'removeAsync',
      javaFactory: `return AND(
  EQ(Rule.ASYNC, true),
  EQ(Rule.OPERATION, Operation.REMOVE)
);`
    },
    {
      class: 'Map',
      name: 'rulesList',
      javaType: 'Map<Predicate, GroupBy>',
      javaFactory: `return new java.util.HashMap<Predicate, GroupBy>();`
    },
    {
      class: 'Map',
      name: 'ruleGroups',
      javaType: 'Map<Predicate, List<RuleGroup>>',
      javaFactory: 'return new java.util.HashMap<Predicate, List<RuleGroup>>();'
    }
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `FObject oldObj = getDelegate().find_(x, obj);
boolean locked = false;
FObject ret;
try {
  if ( oldObj == null ) {
    locked = applyRules(x, obj, oldObj, getCreateBefore());
  } else {
    locked = applyRules(x, obj, oldObj, getUpdateBefore());
  }

  // Clone and pass unfrozen object to 'sync' 'after' rules so, similar
  // to 'before' rules, the rule is not responsible for put'ing
  // and the updated object is properly passed on to the next rule.
  // If the object was modified in an 'after' rule, then it is 'put'.

  ret = getDelegate().put_(x, obj);
} finally {
  if ( locked ) getLock().release();
}

if ( ret != null ) {
  ret = ret.fclone();
  FObject before = ret.fclone();
  if ( oldObj == null ) {
    applyRules(x, ret, oldObj, getCreateAfter());
  } else {
    applyRules(x, ret, oldObj, getUpdateAfter());
  }

  // Test for changes during 'after' rule
  if ( ! before.equals(ret) ) {
    ret = getDelegate().put_(x, ret);
  }
}

// Apply async rules
if ( oldObj == null ) {
  applyRules(x, ret, oldObj, getCreateAsync());
} else {
  applyRules(x, ret, oldObj, getUpdateAsync());
}

return ret;`
    },
    {
      name: 'remove_',
      javaCode: `FObject oldObj = getDelegate().find_(x, obj);
applyRules(x, obj, oldObj, getRemoveBefore());
FObject ret =  getDelegate().remove_(x, obj);
applyRules(x, ret, oldObj, getRemoveAfter());
applyRules(x, ret, oldObj, getRemoveAsync());
return ret;`
    },
    {
      name: 'applyRules',
      type: 'boolean',
      args: 'Context x, foam.lang.FObject obj, foam.lang.FObject oldObj, Predicate pred',
      javaCode: `var logger = (Logger) x.get("logger");
var     ruleGroups = getRuleGroups().get(pred);
var     sink       = getRulesList().get(pred);
boolean locked     = false;
for ( var rg : ruleGroups ) {
  if ( rg.ruleF(x, oldObj, obj) ) {
    var rules = ((ArraySink) sink.getGroups().get(rg.getId())).getArray();
    if ( ! rules.isEmpty() ) {
      locked |= new RuleEngine(x, getX(), getDelegate(), getLock()).execute(rules, obj, oldObj);
    }
  }
}
return locked;
`
    },
    {
      name: 'updateRules',
      args: 'Context x',
      javaCode: `DAO localRuleDAO = getDaoKey().equals("localRuleDAO") ? this : (DAO) x.get("localRuleDAO");
localRuleDAO = localRuleDAO.where(EQ(Rule.DAO_KEY, getDaoKey()));

localRuleDAO.listen(
  new UpdateRulesListSink.Builder(getX())
    .setDao(this)
    .build()
  , null
);

localRuleDAO = localRuleDAO.where(EQ(Rule.ENABLED, true)).orderBy(new Desc(Rule.PRIORITY));
// Set rule context to readonly dao context
localRuleDAO.select(new AbstractSink(new ReadOnlyDAOContext(getX())));

addRuleList(localRuleDAO, getCreateBefore());
addRuleList(localRuleDAO, getUpdateBefore());
addRuleList(localRuleDAO, getRemoveBefore());
addRuleList(localRuleDAO, getCreateAfter());
addRuleList(localRuleDAO, getUpdateAfter());
addRuleList(localRuleDAO, getRemoveAfter());
addRuleList(localRuleDAO, getCreateAsync());
addRuleList(localRuleDAO, getUpdateAsync());
addRuleList(localRuleDAO, getRemoveAsync());

// RuleGroup listener
var ruleGroupDAO = (DAO) x.get("ruleGroupDAO");
ruleGroupDAO.listen(new AbstractSink() {
  @Override
  public void put(Object obj, Detachable sub) {
    updateRuleGroups(getCreateBefore());
    updateRuleGroups(getUpdateBefore());
    updateRuleGroups(getRemoveBefore());
    updateRuleGroups(getCreateAfter());
    updateRuleGroups(getUpdateAfter());
    updateRuleGroups(getRemoveAfter());
    updateRuleGroups(getCreateAsync());
    updateRuleGroups(getUpdateAsync());
    updateRuleGroups(getRemoveAsync());
  }
}, null);`
    },
    {
      name: 'cmd_',
      javaCode: `
  if ( ! ( obj instanceof RulerProbe ) )
    return getDelegate().cmd_(x, obj);

  RulerProbe probe = (RulerProbe) obj;
  switch ( probe.getOperation() ) {
    case UPDATE :
      probeRules(x, probe, probe.getAsync() ? getUpdateAsync()
        : probe.getAfter() ? getUpdateAfter() : getUpdateBefore());
      break;
    case CREATE :
      probeRules(x, probe, probe.getAsync() ? getCreateAsync()
        : probe.getAfter() ? getCreateAfter() : getCreateBefore());
      break;
    case REMOVE :
      probeRules(x, probe, probe.getAsync() ? getRemoveAsync()
        : probe.getAfter() ? getRemoveAfter() : getRemoveBefore());
      break;
    default :
      throw new RuntimeException("Unsupported operation type " + probe.getOperation() + " on dao.cmd(RulerProbe)");
    }
    return probe;`
    },
    {
      name: 'probeRules',
      args: [
        { name: 'x', type: 'X' },
        { name: 'probe', type: 'RulerProbe' },
        { name: 'predicate', type: 'foam.mlang.predicate.Predicate' }
      ],
      javaCode: `GroupBy groups;
Map rulesList = getRulesList();
FObject obj = (FObject) probe.getObject();
FObject oldObj = getDelegate().find_(x, obj);
groups = (GroupBy) rulesList.get(predicate);
for ( Object key : groups.getGroupKeys() ) {
  List<Rule> rules = ((ArraySink)(groups.getGroups().get(key))).getArray();
  new RuleEngine(x, getX(), this).probe(rules, probe, obj, oldObj);
}`
    },
    {
      name: 'addRuleList',
      args: [
        {
          name: 'dao',
          type: 'foam.dao.DAO'
        },
        {
          name: 'predicate',
          type: 'foam.mlang.predicate.Predicate'
        }
      ],
      javaCode: `
getRulesList().put(
  predicate,
  (GroupBy) dao.where(predicate)
               .select(GROUP_BY(Rule.RULE_GROUP, new ArraySink()))
);
updateRuleGroups(predicate);`
    },
    {
      name: 'updateRuleGroups',
      args: [ 'Predicate predicate' ],
      javaCode: `var dao = (DAO) getX().get("ruleGroupDAO");
var groupIds = new ArrayList(getRulesList().get(predicate).getGroupKeys());
var ruleGroups = new ArrayList<RuleGroup>();
dao.where(IN(RuleGroup.ID, groupIds)).select(new AbstractSink() {
  @Override
  public void put(Object obj, Detachable sub) {
    var rg = (RuleGroup) obj;
    ruleGroups.add(rg);
    groupIds.remove(rg.getId());
  }
});
getRuleGroups().put(predicate, ruleGroups);

// Log rule group not found error
var logger = (Logger) getX().get("logger");
for ( var groupId : groupIds ) {
  logger.error("RuleGroup not found. Rules in the group will not be run.", groupId);
}`
    }
  ],

  javaCode: `
    public RulerDAO(foam.lang.X x, foam.dao.DAO delegate, String serviceName) {
      setX(x);
      setDelegate(delegate);
      setDaoKey(serviceName);
      // This doesn't get called when using Builder,
      //   it must be called manually in this case.
      updateRules(x);
    }
  `
});
