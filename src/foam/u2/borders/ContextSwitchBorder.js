/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'ContextSwitchBorder',
  extends: 'foam.u2.Element',
  documentation: 'A simple border that can be used to change context values for child views, more useful when configuring jrl entries. startContext/endContext is better for use in JS',

  // TODO: This can be made more generic by allowing for multiple context values to be set by making these
  // properties into a data model and this view accepting an FObjectArray of that model
  properties: [
    {
      class: 'String',
      name: 'sourceKey',
      documentation: 'The key in the context to override'
    },
    {
      class: 'String',
      name: 'targetKey',
      documentation: 'The key in the context to override with'
    },
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'predicate',
      documentation: 'Optional predicate applied to target Cspec if the given cSpec is a DAO',
      factory: function() {
        return foam.mlang.predicate.True.create();
      }
    }
  ],

  methods: [
    function init() {
      let ctx = this.__subContext__;
      if ( ! ctx || ! ctx[this.sourceKey] || ! ctx[this.targetKey] ) return;
      let valueToSet = ctx[this.targetKey];
      if ( foam.dao.DAO.isInstance(valueToSet) ) {
        valueToSet = valueToSet.where(this.predicate);
      }
      this
        .startContext({ [this.sourceKey]: valueToSet });
    },
    function render() {
      this.addClass();
    }
  ]
});
