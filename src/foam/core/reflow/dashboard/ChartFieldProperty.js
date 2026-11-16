/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'ChartFieldProperty',
  extends: 'foam.mlang.ExprProperty',
  // The Java build reads this class to type the sinks' fields, but must not
  // generate a Java class for it, the same as ExprProperty.
  flags: [],

  documentation: `
    A field a dashboard chart groups its data by, edited in the chart's form
    and saved with the flow: a Pie's Property, a Line's X Property. It holds a
    property of the chart's data, or an expression on one such as "month of
    createdAt".
  `,

  properties: [
    {
      name: 'view',
      value: function(_, X) {
        return { class: 'foam.core.reflow.PropertyExprView', forCls: X.dao ? X.dao.of : undefined };
      }
    },
    [
      'isDefaultValue',
      // The picker writes null when it first renders, and ExprProperty stores
      // that as Constant(null). So an untouched field holds Constant(null),
      // which a required check and hasDefaultValue() must count as empty.
      function(v) { return ! v || foam.mlang.Constant.isInstance(v) && v.value == null; }
    ]
  ]
});


foam.CLASS({
  package: 'foam.core.reflow.dashboard',
  name: 'ChartChoiceFieldProperty',
  extends: 'foam.core.reflow.dashboard.ChartFieldProperty',
  flags: [],

  documentation: `
    An optional chart field that picks a plain property, such as Line's
    "Group By (Multiple Lines)" or Calendar's Category Property.
  `,

  properties: [
    {
      name: 'view',
      value: function(_, X) {
        return { class: 'foam.core.reflow.PropertyChoiceView', forCls: X.dao ? X.dao.of : undefined };
      }
    }
  ]
});
