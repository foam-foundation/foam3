/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'RemoteListeners',

  documentation: `The listens one connection's client made, by the name each sink was exported under.
    One per WebSocket connection (NanoWebSocket puts it in the context as "remoteListeners"), so a
    StopListeningCmd can only stop a listener of the connection it came on. Names are unique per client page.`,

  javaImports: [
    'foam.dao.Sink',
    'java.util.Map',
    'java.util.concurrent.ConcurrentHashMap'
  ],

  properties: [
    {
      class: 'Object',
      name: 'sinks',
      javaType: 'Map<String, StoppableSink>',
      javaFactory: 'return new ConcurrentHashMap<String, StoppableSink>();'
    }
  ],

  methods: [
    {
      name: 'track',
      args: 'String name, Sink sink',
      type: 'foam.dao.Sink',
      documentation: 'Wrap a listen\'s sink so the client can stop it later by name.',
      javaCode: `
        StoppableSink s = new StoppableSink.Builder(getX()).setDelegate(sink).setName(name).setListeners(this).build();
        getSinks().put(name, s);
        return s;
      `
    },
    {
      name: 'stop',
      args: 'String name',
      documentation: 'Stop the listener exported under name. Unknown names are ignored.',
      javaCode: `
        StoppableSink s = getSinks().remove(name);
        if ( s != null ) s.stop();
      `
    },
    {
      name: 'stopAll',
      documentation: 'The connection closed: stop every listener it made.',
      javaCode: `
        for ( String name : getSinks().keySet() ) stop(name);
      `
    },
    {
      name: 'forget',
      args: 'String name',
      javaCode: `getSinks().remove(name);`
    },
    {
      name: 'size',
      type: 'Integer',
      javaCode: `return getSinks().size();`
    }
  ]
});
