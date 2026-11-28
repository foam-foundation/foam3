/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'StoppableSink',
  extends: 'foam.dao.ProxySink',

  documentation: `
    The server end of one listener from a client.
    stop() ends it now if an event has come in, or at the next event.
    If the client cannot be reached, it leaves its RemoteListeners.
  `,

  javaImports: [
    'foam.lang.Detachable'
  ],

  properties: [
    {
      class: 'String',
      name: 'name'
    },
    {
      class: 'Object',
      name: 'listeners',
      javaType: 'foam.dao.RemoteListeners',
      documentation: 'The list this sink is in.'
    },
    {
      class: 'Boolean',
      name: 'stopped'
    },
    {
      class: 'Object',
      name: 'sub',
      javaType: 'foam.lang.Detachable',
      documentation: 'What detaches this listener on the DAO (taken from the last event).'
    }
  ],

  methods: [
    {
      name: 'stop',
      documentation: 'Stop now if we can, else at the next event.',
      javaCode: `
        setStopped(true);
        Detachable sub = getSub();
        if ( sub != null ) sub.detach();
      `
    },
    {
      name: 'heard',
      args: 'Detachable sub',
      type: 'Boolean',
      documentation: 'Remember sub. True when the event may go on to the client.',
      javaCode: `
        if ( sub != null ) setSub(sub);
        if ( ! getStopped() ) return true;
        if ( sub != null ) sub.detach();
        return false;
      `
    },
    {
      name: 'failed',
      args: 'RuntimeException e',
      documentation: 'The client is gone: leave the list, and rethrow so the DAO drops this listener.',
      javaCode: `
        if ( getListeners() != null ) getListeners().forget(getName());
        throw e;
      `
    },
    {
      name: 'put',
      javaCode: `
        if ( ! heard(sub) ) return;
        try { getDelegate().put(obj, sub); } catch ( RuntimeException e ) { failed(e); }
      `
    },
    {
      name: 'remove',
      javaCode: `
        if ( ! heard(sub) ) return;
        try { getDelegate().remove(obj, sub); } catch ( RuntimeException e ) { failed(e); }
      `
    },
    {
      name: 'reset',
      javaCode: `
        if ( ! heard(sub) ) return;
        try { getDelegate().reset(sub); } catch ( RuntimeException e ) { failed(e); }
      `
    }
  ]
});
