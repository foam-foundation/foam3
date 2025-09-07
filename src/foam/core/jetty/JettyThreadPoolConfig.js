/**
* @license
* Copyright 2020 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/
foam.CLASS({
  package: 'foam.core.jetty',
  name: 'JettyThreadPoolConfig',
  documentation: 'model of org.eclipse.jetty.server.ThreadPool',
  properties: [
    {
      name: 'minThreads',
      class: 'Int',
      value: 8
    },
    {
      name: 'maxThreads',
      class: 'Int',
      value: 1000
    },
    {
      name: 'idleTimeout',
      class: 'Int',
      value: 60000
    },
    {
      name: 'enableVirtualThreads',
      class: 'Boolean',
      value: true
    }
  ]
});
