/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'StoppableSink',
  extends: 'foam.dao.ProxySink',

  documentation: `The server side of one remote listen. Holds the subscription the DAO handed it,
    so stop() detaches the listener at once if an event has arrived, else on the next event.
    A delegate that fails (the client is gone) takes it out of its RemoteListeners.`,

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
      documentation: 'The connection\'s list this sink is in.'
    },
    {
      class: 'Boolean',
      name: 'stopped'
    },
    {
      class: 'Object',
      name: 'sub',
      javaType: 'foam.lang.Detachable',
      documentation: 'The DAO\'s subscription, from the last event.'
    }
  ],

  methods: [
    {
      name: 'stop',
      documentation: 'Detach now if the DAO\'s subscription is known, else at the next event.',
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
      documentation: 'Keep the subscription; true when the event may go on to the client.',
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
      documentation: 'The client could not be reached: leave the list, and let the DAO drop this listener.',
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
