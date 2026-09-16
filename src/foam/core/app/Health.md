<flow name="Health" category="DOC/DEV" spid="foam"/>
<title>Health (DevOps)</title>
<h1>Health</h1>
<h2>Overview</h2>
<p>The Health system is intended for monitoring and reporting the status of FOAM applications.</p>
<p>Each instance sends a UDP heartbeat via multicast broadcast, and each instance listens for heartbeats. The healthDAO displays detected instances along with status and heartbeat stats.</p>
<p>The HealthWebAgent reports the Health Status of an instance, intended to be consumed by Load Balancers (LB) to determine when an instance is in an appropriate state to receive traffic. (see below)</p>
<p>The heartbeat UDP packet is sent, by default, to multicast address 230.22.41.0 and port 52241.  This address and port must be open on firewalls between instances which use this type of monitoring.</p>

<h2>HealthWebAgent</h2>
<p>The HealthWebAgent is hosted at
<code>/service/health?format=html</code>
Using url query parameter <b>format=html</b> will return just the Health Status string suitable for Load Balancer consumption.
<ul>
<li>DOWN: instance is shutdown</li>
<li>MAINT: instance is starting up (replay), but not yet ready for traffic</li>
<li>UP: instance is in it's normal operation state, ready to handle traffic</li>
<li>FAIL: instance is in some unrecoverable state</li>
<li>DRAIN: instance is shutting down. LB should stop sending new traffic.</li>
</ul>
The default FOAM supports DOWN and UP, other states are left for application implementation. An application would provide it's own HealthWebAgent to report appropriately. For example, reporting MAINT until replay is complete.  (see foam-medusa for example)<br/>
</p>
<p><b>NOTE</b> The HealthWebAgent only works with <b>HTTPS</b></p>

<h2>VersionWebAgent</h2>
<p>The application version is available through the VersionWebAgent hosted at
<code>service/version</code>
</p>
