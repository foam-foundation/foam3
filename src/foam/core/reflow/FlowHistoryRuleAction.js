/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowHistoryRuleAction',

  documentation: `Runs after each flowDAO put and appends a FlowHistoryRecord
    to flowHistoryDAO listing the storage properties that changed. A put that
    changed nothing writes no record.`,

  implements: [ 'foam.core.ruler.RuleAction' ],

  javaImports: [
    'foam.core.auth.Subject',
    'foam.dao.DAO',
    'foam.dao.history.PropertyUpdate',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.lang.X',
    'foam.lib.PropertyPredicate',
    'foam.lib.StorageOptionalPropertyPredicate',
    'foam.lib.StoragePropertyPredicate',
    'java.util.ArrayList',
    'java.util.Date'
  ],

  javaCode: `
    private static final PropertyPredicate STORAGE  = new StoragePropertyPredicate();
    private static final PropertyPredicate OPTIONAL = new StorageOptionalPropertyPredicate();
  `,

  methods: [
    {
      name: 'applyAction',
      javaCode: `
        PropertyUpdate[] updates = oldObj == null ? new PropertyUpdate[0] : diff(x, oldObj, obj);
        if ( oldObj != null && updates.length == 0 ) return;

        FlowHistoryRecord record = new FlowHistoryRecord();
        record.setObjectId((String) obj.getProperty("id"));
        record.setTimestamp(new Date());
        record.setUpdates(updates);

        Subject subject = (Subject) x.get("subject");
        if ( subject != null && subject.getUser() != null ) {
          record.setUser(subject.getUser().toSummary());
        }

        agency.submit(x, new ContextAgent() {
          @Override
          public void execute(X x) {
            ((DAO) x.get("flowHistoryDAO")).put_(x, record);
          }
        }, "Recording flow history");
      `
    },
    {
      name: 'diff',
      type: 'foam.dao.history.PropertyUpdate[]',
      args: 'X x, FObject oldObj, FObject obj',
      documentation: 'Storage properties whose value changed; the same selection HistoryDAO records.',
      javaCode: `
        var updates = new ArrayList<PropertyUpdate>();
        var info    = obj.getClassInfo();
        var of      = info.getSimpleName().toLowerCase();
        var props   = info.getAxiomsByClass(PropertyInfo.class);

        for ( var prop : props ) {
          if ( STORAGE.propertyPredicateCheck(x, of, prop)
            && ! OPTIONAL.propertyPredicateCheck(x, of, prop)
            && prop.compare(oldObj, obj) != 0
          ) {
            updates.add(new PropertyUpdate(prop.getName(), prop.f(oldObj), prop.f(obj)));
          }
        }

        return updates.toArray(new PropertyUpdate[updates.size()]);
      `
    }
  ]
});
