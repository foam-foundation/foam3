/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.alarming',
  name: 'AlarmConfigOMNameDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `Load OMName with AlarmConfig names on select, as OMName is MDAO only to support creating alarms before the OM has been generated.

omNameDAO, the list the AlarmConfig OM pickers offer, therefore holds only
the OM names some AlarmConfig already uses. A name that code logs but no
config references is not offered until a config that uses it is loaded, for
example from an alarmConfigs journal.

AlarmingUniqueNameDAO would add every logged OM name, as a decorator on
localOm1MinuteDAO, but it is not wired by default because of its cost.
OMLoggerBenchmark (foam/core/benchmark) measured it on one laptop, one
thread, 10 executions per sample:
- A log that creates a new Candlestick, the first log of a name in a minute,
  went from 1.66 to 3.57 microseconds, about 1.9 more, 2.15 times the cost.
  OMLoggerNewKeysBenchmarkRunner, 60,000 new names per execution: 10.07
  executions per second without the decorator, 4.68 with it, two samples
  each.
- A log that adds to an existing Candlestick does not reach the decorator,
  since only a new Candlestick is put.
- omNameDAO keeps every name ever logged in memory until restart, so a name
  that embeds a value, such as an error code, adds one entry per value.

An application that wants every logged name offered can add the decorator in
its own localOm1MinuteDAO service, at about 1.9 microseconds per OM name per
minute, about 2 ms per minute for 1,000 names:

  .setDecorator(new foam.core.alarming.AlarmingUniqueNameDAO.Builder(x)
    .setDelegate(new foam.dao.NullDAO(x, foam.core.analytics.Candlestick.getOwnClassInfo()))
    .build())`,

  javaImports: [
    'foam.dao.DAO',
    'foam.dao.Sink',
  ],

  methods: [
    {
      name: 'select_',
      javaCode: `
        Sink decoratedSink = new AlarmConfigOMNameSink(x, sink, (DAO) x.get("omNameDAO"));
        getDelegate().select_(x, decoratedSink, skip, limit, order, predicate);
        return sink;
      `
    }
  ]
 });
