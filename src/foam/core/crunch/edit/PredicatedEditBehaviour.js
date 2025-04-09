/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.crunch.edit',
  name: 'PredicatedEditBehaviour',
  extends: 'foam.core.crunch.edit.AbstractEditBehaviour',
  documentation: `Edit Behaviour that blocks or allows edits based on a predicate result. 
  Both RulePredicates and regular predicates are supported. RulePredicates are typically easier to write for comparing different objects hence the support here.`,

  classes: [
    // This is similar to what RulePredicate/RuleData does, maybe make an abstract class
    {
      name: 'EditBehaviourData',
      properties: [
        {
          class: 'FObjectProperty',
          name: 'o',
          documentation: 'oldUCJ (existing UCJ)'
        },
        {
          class: 'FObjectProperty',
          name: 'n',
          documentation: 'newUCJ, same as old UCJ but with updated data. Warning: status should not be tested as it might change later in the rule stack for UCJDAO'
        },
        {
          class: 'StringArray',
          name: 'diff',
          javaFactory: `
            if ( getO() == null ) {
              return new String[0];
            }
            return (String[]) getN().diff(getO()).keySet().toArray(String[]::new);
          `
        },
        {
          class: 'FObjectProperty',
          name: 'user',
          documentation: 'user the UCJ belongs to'
        },
        {
          class: 'FObjectProperty',
          name: 'realUser',
          documentation: 'user trying to edit the UCJ, might be the same as user but not guaranteed'
        },
        {
          class: 'String',
          name: 'spid',
          documentation: 'spid in the current context'
        }
      ]
    }
  ],

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.core.auth.Subject',
    'foam.core.crunch.UserCapabilityJunction',
    'foam.core.ruler.RulePredicate'
  ],

  properties: [
    {
      name: 'wizardletBorder',
      factory: function() {
        return 'foam.u2.wizard.views.PermissiveEditWizardletBorder';
      }
    },
    {
      name: 'comparator',
      class: 'foam.mlang.predicate.PredicateProperty',
      factory: function() {
        return this.True.create();
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `
    }
  ],

  methods: [
    {
      name: 'maybeApplyEdit',
      javaCode: `
        Subject subject = (Subject) userX.get("subject");
        var newUCJ = (UserCapabilityJunction) ((UserCapabilityJunction) ucj).fclone();
        newUCJ.setData(newData);
        var ret = false;

        // If predicate is a rule predicate just pass both ucjs and let the predicate handle adding additional props to the obj to compare
        // otherwise build an object and call f();
        if ( RulePredicate.class.isInstance(getComparator()) ) {
          ret = (boolean) getComparator().ruleF(userX, ucj, newUCJ);
        } else {
          EditBehaviourData data = new EditBehaviourData();
          data.setO(ucj);
          data.setN(newUCJ);
          data.setUser(subject.getUser());
          data.setRealUser(editor);
          data.setSpid(subject.getUser().getSpid());
          ret = (boolean) getComparator().f(data);
        }
        if (ret) { 
          ucj.setData(newData);
          return true;
        } else {
          return false;
        }
      `
    }
  ]
});
