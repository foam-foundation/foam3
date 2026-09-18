<flow name="Health" category="DOC/DEV" spid="foam" label="Health (DevOps)"/>

# Health

## Overview

The Health system is intended for monitoring and reporting the status of FOAM applications.

Each instance sends a UDP heartbeat via multicast broadcast, and each instance listens for heartbeats. The healthDAO displays detected instances along with status and heartbeat stats.

The HealthWebAgent reports the Health Status of an instance, intended to be consumed by Load Balancers (LB) to determine when an instance is in an appropriate state to receive traffic. (see below)

The heartbeat UDP packet is sent, by default, to multicast address 230.22.41.0 and port 52241.  This address and port must be open on firewalls between instances which use this type of monitoring.

## HealthWebAgent

The HealthWebAgent is hosted at
`/service/health?format=html`
Using url query parameter **format=html** will return just the Health Status string suitable for Load Balancer consumption.

- DOWN: instance is shutdown
- MAINT: instance is starting up (replay), but not yet ready for traffic
- UP: instance is in it's normal operation state, ready to handle traffic
- FAIL: instance is in some unrecoverable state
- DRAIN: instance is shutting down. LB should stop sending new traffic.

The default FOAM supports DOWN and UP, other states are left for application implementation. An application would provide it's own HealthWebAgent to report appropriately. For example, reporting MAINT until replay is complete.  (see foam-medusa for example)**

<b>NOTE** The HealthWebAgent only works with **HTTPS**

## VersionWebAgent

The application version is available through the VersionWebAgent hosted at
`service/version`
