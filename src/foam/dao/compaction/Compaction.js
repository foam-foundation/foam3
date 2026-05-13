/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao.compaction',
  name: 'Compaction',
  documentation: `Compaction dumps an MDAO out to a new journal file, in a effort to reduce replay time.  Each DAO operation on the same object generates an entry  containing just the change on the object.  In time there are multiple entries for the same object.  Compaction writes out each object in entirety once, thus reducing the multiple entry to just one, and reducing replay time.
Used in conjuction with a custom compaction sink, the compaction process can facilitate archiving with only recent or active objects written to the new journal.
`,

  ids: ['cSpec'],

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.boot.CSpec',
      name: 'cSpec',
      label: 'CSpec',
      tableWidth: 225,
      view: function(_, X) {
        var E = foam.mlang.Expressions.create();
        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          sections: [
            {
              heading: 'DAO',
              dao: X.cSpecDAO
                .where(E.ENDS_WITH(foam.core.boot.CSpec.ID, 'DAO'))
                .orderBy(foam.core.boot.CSpec.ID)
            }
          ]
        };
      }
    },
    {
      documentation: `DAO is eligible for compaction, meaning it's entries will be reduced. If compaction is disabled (false), then the DAO's entries will be discarded - they will not be compacted into a new ledger.`,
      name: 'compactible',
      class: 'Boolean',
      value: true
    },
    {
      name: 'predicate',
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      view: { class: 'foam.u2.view.JSONTextView' }
    },
    {
      documentation: 'LifecycleAware objects which are deleted/removed are set to state DELETED, an r() journal entry is not created.  This option allows to compact DELETED entries.',
      name: 'discardLifecycleDeleted',
      class: 'Boolean',
      value: true
    },
    {
      name: 'createdSince',
      class: 'DateTime'
    },
    {
      name: 'lastModifiedSince',
      class: 'DateTime'
    },
    {
      documentation: 'Name for JDAO creation during loading. Default is best gues. Required when nspec has JDAO setup outside of EasyDAO.',
      name: 'journalName',
      class: 'String',
      javaFactory: `
      var name = getCSpec();
      name = name.replace("DAO", "");
      name = name.replace("local", "");
      name = name.toLowerCase();
      name = name + "s";
      return name;
      `
    }
  ]
});
