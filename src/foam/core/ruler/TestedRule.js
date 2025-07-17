/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ruler',
  name: 'TestedRule',
  extends: 'foam.lang.AbstractAgency',
  documentation: `The model is for reporting purposes when probing rules.
  rulerProbe = dao.cmd(RulerProbe) object will be returned with list of TestedRules
  where each describes whether the rule was applied and summary of the rule's activities.`,

  javaImports: [
    'foam.core.ruler.Rule',
    'java.util.ArrayList',
    'foam.lang.X'
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.ruler.Rule',
      name: 'rule'
    },
    {
      class: 'String',
      name: 'message'
    },
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'Boolean',
      name: 'passed',
      value: true
    },
    {
      class: 'FObjectProperty',
      name: 'probeInfo'
    }
  ],
  methods: [
    {
      name: 'submit',
      javaCode: `/* noop */
        return null;
      `
    },
    {
      name: 'schedule',
      javaCode: '/* noop */'
    },
    {
      name: 'toString',
      type: 'String',
      javaCode: `StringBuilder sb = new StringBuilder();
      return sb.append("Rule id: ").append(getRule()).append(". Passed: ").append(getPassed()).
      append( ". Message: ").append(getMessage()).toString();`
    }
  ]
});
