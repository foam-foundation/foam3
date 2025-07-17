/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'CompoundContextAgency',
  extends: 'foam.lang.AbstractAgency',

  javaImplements: [
    'foam.lang.ContextAgent'
  ],

  javaImports: [
    'foam.core.logger.Logger',
    'java.util.ArrayList',
    'foam.core.pm.PM'
  ],

  properties: [
    {
      name: 'agents',
      class: 'List',
      javaType: 'ArrayList<Runnable>',
      javaFactory: `return new ArrayList();`
    }
  ],

  methods: [
    {
      name: 'execute',
      args: [
        { name: 'x', type: 'X' }
      ],
      javaCode: `CompoundException e = null;
Logger logger = (Logger) x.get("logger");
for ( Runnable agent : getAgents() ) {
  PM pm = PM.create(x, this.getClassInfo(), agent.toString());
  try {
    agent.run();
  } catch (Throwable t) {
    logger.error(t.getMessage(), t);
	  if ( e == null ) e = new CompoundException();
      e.add(t);
  } finally {
    pm.log(x);
  }
}
if ( e != null ) e.maybeThrow();`
    },
    {
      name: 'submit',
      args: [
        { name: 'x', type: 'X' },
        { name: 'agent', type: 'ContextAgent' },
        { name: 'description', type: 'String' }
      ],
      javaCode: `
        getAgents().add(new ContextAgentRunnable(x, agent, description));
        return null;
      `
    },
    {
      name: 'toString',
      type: 'String',
      javaCode: `StringBuilder sb = new StringBuilder();
boolean first = true;
for ( Runnable agent : getAgents() ) {
  if ( first ) {
    first = false;
  } else {
    sb.append(System.lineSeparator());
  }
  sb.append(agent.toString());
}
return sb.toString();`
    },
    {
      name: 'describeAgents',
      type: 'String[]',
      javaCode: `String[] desc = new String[getAgents().size()];
for ( int i = 0 ; i < getAgents().size() ; i++ ) {
  desc[i] = getAgents().get(i).toString();
}
return desc;`
    }
  ],
  javaCode: `
    public void submit(foam.lang.X x, foam.lang.ContextAgent agent) {
      submit(x, agent, "");
    }
  `
});
