/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.core.app',
  name: 'HeartbeatMode',

  documentation: `How HealthHeartbeatService delivers and receives Health
    heartbeats. Replaces the old useMulticast boolean: it had only on/off,
    but there are three distinct deliveries, two of which are multicast.`,

  values: [
    {
      name: 'BROADCAST',
      label: 'Broadcast',
      documentation: `Multicast to the group on the OS default network
        interface. The original behaviour (old useMulticast = true).`
    },
    {
      name: 'LOOPBACK',
      label: 'Loopback',
      documentation: `Multicast pinned to the loopback interface. For several
        instances sharing one host (local development) where a VPN or an
        interface change would otherwise route the group off the machine and
        the instances never hear each other.`
    },
    {
      name: 'DIRECT',
      label: 'Direct',
      documentation: `Unicast a copy of the heartbeat to each peer host:port
        from getPeers(). For environments such as AWS that do not support
        multicast (old useMulticast = false, which was never implemented).`
    }
  ]
});
