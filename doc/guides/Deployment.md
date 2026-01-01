# Deployment (DevOps)

FOAM has support for building, uploading, and install a complete application.

## Building for deployment

Deployment builds generate a tar ball:

    node foam3/tools/build.js -ckJyour_deployment_directories,../foam3/deployment/https

Once a tar ball is prepared, it can be uploaded and the application installed

    ./build.sh -TStandard,Java,RemoteInstall -Jyour_deployment_directories --remote-hostname:hostname

## Additional (most common) installation flags:

- `--user:name` -  User name to create and run application under. Defaults to **foam**
- `--user-id:id` -  User ID to create User with. Defaults to **3626**
- `--backup:true|false` - Controls backup of previous version during install. Defaults to **true**.
    - For a quick development, deploy cycle, and for non-production instances, set backup to false.


## SSH Considerations

**NOTE** The upload and install process assume the uploader's ssh key is installed on the remote host, and that ssh has been configured for no-password logins.

### SSH Key Pair Generation

- see [How to Create an SSH Key](https://www.digitalocean.com/community/tutorials/how-to-configure-ssh-key-based-authentication-on-a-linux-server) or 
- see [How to Set Up SSH Keys](https://www.digitalocean.com/community/tutorials/how-to-set-up-ssh-keys-on-ubuntu-20-04)

### SSH No-Password Login

- see [How to Setup Passwordless SSH Login](https://linuxize.com/post/how-to-setup-passwordless-ssh-login/)

## JVM Memory

JVM Memory configuration defaults to `-Xms2048m` and `-Xmx4096`. 

These properties can be overridden after first deployment by adding them to:

    /opt/name/conf/shrc.custom

`#!/bin/bash`
`  JAVA_OPTS="${JAVA_OPTS} -Xmx8000m"`

Or per deployment with

    ./build.sh -EJAVA_OPTS:"-Xms4g -Xmx8g"
    or
    ./build.sh --system-property:Xms4g,Xmx8g

## JVM Other Defaults and Tuning

Other JVM options, such as Garbage Collection, are defined in:

    /opt/name/etc/shrc.local

To override add to 

    /opt/name/conf/shrc.local

## Remote Monitoring / Health

The Health system is intended for production monitoring (and LB integration) of the status of FOAM applications.

### HealthWebAgent

The HealthWebAgent reports the Health Status of an instance, intended to be consumed by Load Balancers (LB) to determine when an instance is in an appropriate state to receive traffic. 

The HealthWebAgent is hosted at

    /service/health?format=html

Using url query parameter `format=html` will return just the Health Status string suitable for Load Balancer consumption.

- DOWN: instance is shutdown
- MAINT: instance is starting up (replay), but not yet ready for traffic
- UP: instance is in it's normal operation state, ready to handle traffic
- FAIL: instance is in some unrecoverable statem
- DRAIN: instance is shutting down. LB should stop sending new traffic.

The default FOAM supports DOWN and UP, other states are left for application implementation. An application would provide it's own HealthWebAgent to report appropriately. For example, reporting MAINT until replay is complete.  (see foam-medusa for example)

**NOTE** The HealthWebAgent only works with **HTTPS**

### VersionWebAgent

The application version is available through the VersionWebAgent hosted at

    service/version

### Application clusters - Heartbeat

When deploying clusters of applications, such as Medusa, foam provides a **Heartbeat** system to allow individual intances to respond to changing state of other instances. 

Each instance sends a UDP heartbeat via multicast broadcast, and each instance listens for heartbeats. The healthDAO displays detected instances along with status and heartbeat stats.

The heartbeat UDP packet is sent, by default, to multicast address 230.22.41.0 and port 52241.  This address and port must be open on firewalls between instances which use this type of monitoring.

The heartbeat broadcast and monitoring system is **disabled** by default.  To **enable**, create `services.jrl` entries at the application deployment level, enabling both `healthSupport` and `healthHeartbeatService`: 

```
p({
  "class": "foam.core.boot.CSpec",
  "name": "healthHeartbeatService",
  "enabled": true
})
p({
  "class": "foam.core.boot.CSpec",
  "name": "healthHeartbeatMonitor",
  "enabled": true
})
```

## Content Security Policy (CSP) Configuration (DAO-driven)
See https://content-security-policy.com/

FOAM builds the Content-Security-Policy header at runtime from entries in a DAO of CSPDirective objects. This replaces the older approach of hard-coding a CSP string in CSPFilter initParameters. FOAM ships production-ready defaults; your app can append, override, disable, and domain-scope directives as needed.

### Where to configure
- Framework defaults: foam3/src/cspdirectives.jrl (and package-specific files, e.g., io/c9/ace/cspdirectives.jrl)
- Application overrides/additions: journals/cspdirectives.jrl or src/cspdirectives.jrl based on your app code structure

Each entry is a journal put of foam.core.http.csp.CSPDirective:

```javascript
p({class:"foam.core.http.csp.CSPDirective", key:"mycompany", name:"script-src", value:"'self' https://cdn.example.com"})
```

### How directives are merged
FOAM’s CSPFilter groups entries by directive name and concatenates values (and hashes) from all enabled entries matching the request domain:
- Append: Same name, different key → tokens are concatenated
- Override: Same name and key → later value replaces earlier value
- Disable: Set enabled:false on the entry you want to exclude
- Domain scope: Set domain:"hostname" to apply only on that virtual host (default is wildcard "*")

This enables a clean pattern: keep FOAM defaults, and add your app’s entries with a different key (e.g., "mycompany"). Only override/disable when you intentionally diverge from defaults.

### cspNonce and CSP directives
- Server property (services.jrl): VirtualHostRoutingServlet.cspNonce outputs a `<meta name="csp-nonce" ...>` and applies the nonce to server-emitted style/script tags.
- CSP header (DAO): Add matching `'nonce-...'` tokens to the CSP so the browser accepts nonce-bearing elements.
  - Nonces apply to `<style>` and `<script>` elements (style-src-elem, script-src). They do not apply to style attributes (style-src-attr). For attributes, use 'unsafe-hashes' with specific hashes or avoid inline styles.

Example:
```javascript
// services.jrl (server emits the nonce)
p({
  class: "foam.core.boot.CSpec", name: "http",
  service: { class: "foam.core.jetty.HttpServer",
    servletMappings: [{
      class: "foam.core.servlet.ServletMapping",
      servletObject: {
        class: "foam.core.servlet.VirtualHostRoutingServlet",
        defaultHost: "localhost",
        cspNonce: "123456789120000"
      },
      pathSpec: "/*"
    }]
  }
})

// journals/cspdirectives.jrl (browser accepts nonce’d elements)
p({class:"foam.core.http.csp.CSPDirective", key:"nonce", name:"script-src", value:"'nonce-123456789120000'"})
p({class:"foam.core.http.csp.CSPDirective", key:"mycompany",  name:"style-src-elem", value:"'self' https://fonts.googleapis.com 'nonce-123456789120000'"})
```

### Practical examples
1) Add a new allowed source (e.g., CDN for a third-party library)
```javascript
// Appends to FOAM defaults for script-src
p({class:"foam.core.http.csp.CSPDirective", key:"mycompany", name:"script-src",
   value:"https://cdn.jsdelivr.net https://cdnjs.cloudflare.com"})
```

2) Domain-scoped directive (dev-only allowances)
```javascript
// Allow source maps/fetches only on localhost
p({class:"foam.core.http.csp.CSPDirective", key:"dev", domain:"localhost",
   name:"connect-src", value:"https://cdn.jsdelivr.net"})
```

3) Disable a FOAM default directive
```javascript
// Remove FOAM’s default connect-src for all domains, then define a minimal one
p({class:"foam.core.http.csp.CSPDirective", key:"foam", name:"connect-src", enabled:false})
p({class:"foam.core.http.csp.CSPDirective", key:"mycompany", name:"connect-src", value:"'self'"})
```

4) Inline style attributes (style-src-attr) and hashes
```javascript
// Attributes cannot use nonces; allow only specific hashed content
p({class:"foam.core.http.csp.CSPDirective", key:"mycompany", name:"style-src-attr",
   value:"'unsafe-hashes'", hash:"'sha256-abc123...='"})
// The browser console will print the exact hash needed when a CSP violation occurs - in some cases.
```

### Why static nonces can be acceptable in FOAM3
FOAM apps are typically SPAs: the initial HTML is minimal and content loads via authenticated APIs. With FOAM’s auth/session layers, using a fixed nonce per deployment can be operationally simpler while still meeting security goals. If your threat model requires per-request nonces, you can rotate cspNonce dynamically and update matching CSPDirective entries accordingly.
