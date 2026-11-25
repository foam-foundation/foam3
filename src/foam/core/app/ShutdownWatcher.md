<flow name="ShutdownWatcher" category="DOC/DEV" spid="foam" label="ShutdownWatcher (DevOps)" description="Touch-file control of a running instance: shut it down with ShutdownWatcher, and set its Health status with HealthStatusWatcher so a load balancer drains it first." keywords="shutdown,watcher,touch file,health,load balancer,drain,deployment,knowledge"/>

# ShutdownWatcher

## Overview

A deployment script or an operator controls a running instance by creating an empty file in a
directory the instance watches. The file's name is the request. There is no port, login or API
call involved: `touch` is enough.

Two watchers use this mechanism:

| Watcher | Directory | Requests | Effect |
|---|---|---|---|
| `foam.core.app.ShutdownWatcher` | `.../shutdown` | `SHUTDOWN`, `ABORT_SHUTDOWN` | Exits the JVM after a delay |
| `foam.core.saf.HealthStatusWatcher` (foam-saf) | `.../healthstatus` | `DOWN`, `MAINT`, `UP`, `FAIL`, `DRAIN` | Sets the instance's Health status |

Use them together for a graceful shutdown. Set the status first so the load balancer (LB) stops
sending traffic, wait for the instance to go idle, then shut it down.

## The watch directory

Each watcher watches its own directory:

```
<java.io.tmpdir>/<hostname>/<appName>/<watcher>
```

- **java.io.tmpdir** is `/tmp` on Linux.
- **hostname** is the `-Dhostname` system property, which the run scripts set to `hostname -s`.
  If it is missing or is `localhost`, the OS user name is used instead.
- **appName** is the `appConfig` name with spaces removed.
- **watcher** is the class name without `Watcher`, in lower case: `shutdown` or `healthstatus`.

For example, on a Linux host named `app1` running `paytic`:

```
/tmp/app1/paytic/shutdown
/tmp/app1/paytic/healthstatus
```

The instance creates the directory itself, about 5 seconds after startup, and logs the path it
is watching, on an INFO line from the watcher with the word `execute`:

```
... ShutdownWatcher ... execute /tmp/app1/paytic/shutdown
```

Look for that line in the log to find the exact path on any host.

## ShutdownWatcher

### Shut down

```
touch /tmp/app1/paytic/shutdown/SHUTDOWN
```

The instance logs `Shutdown requested.` and then `Shutdown in 30 seconds`. After the delay it
logs `Shutdown now` and calls `System.exit(0)`, which runs the JVM's shutdown hooks.

The delay is the `delay` property, in seconds, and defaults to 30. With a delay of 0 the
instance exits at once.

### Abort a shutdown

During the delay:

```
touch /tmp/app1/paytic/shutdown/ABORT_SHUTDOWN
```

The instance logs `Shutdown abort requested.` and `Shutdown aborted` at once, and keeps running.
The abort cancels only the shutdown that is waiting: a later `SHUTDOWN` works as normal.

A `SHUTDOWN` while one is already waiting is logged and ignored; the first one's delay still
applies. An `ABORT_SHUTDOWN` with no shutdown waiting is logged and does nothing.

### Install

ShutdownWatcher is part of foam3 but is not enabled by default. An application enables it in
its `services.jrl`:

```
p({
  "class": "foam.core.boot.CSpec",
  "name": "shutdownWatcher",
  "lazy": false,
  "serviceClass": "foam.core.app.ShutdownWatcher"
})
```

`"lazy": false` starts the watcher at boot. A lazy service starts only when something looks it
up, and nothing looks up a watcher.

## HealthStatusWatcher

### Health status and the load balancer

`/service/health` reports the instance's Health status. It returns HTTP **200** when the status
is `UP` and **503** for any other status. The body is the status in lower case, such as `up` or
`down`. An LB health check sends traffic only to instances that return 200. See the **Health
(DevOps)** doc for the full list of statuses.

### Set the status

Touch a file named after the status:

```
touch /tmp/app1/paytic/healthstatus/DRAIN
touch /tmp/app1/paytic/healthstatus/UP
```

The instance logs the old and new status, saves the new status to `healthDAO`, and
`/service/health` reports it straight away. A file whose name is not a status is rejected and
logged.

### A new instance starts DOWN

With foam-saf, an instance starts with the status `DOWN`, and **nothing sets it to `UP` on its
own**. Until a deployment script or an operator marks it `UP`, `/service/health` returns 503 and
an LB sends it no traffic.

The deployment decides when an instance is ready. A common choice is to wait until replay is
complete, for example until a particular DAO has finished loading, and then touch `UP`.

The status also controls work inside the instance:

- Clusterable crons run only while the status is `UP`.
- SAF forwards entries only while the status is `UP` or `DRAIN`. In any other status it drops
  them.

Use `DRAIN` rather than `DOWN` to take an instance out of the LB while it is still working, so
SAF keeps forwarding.

### Install

foam-saf enables it in `deployment/saf/services.jrl`:

```
p({
  "class": "foam.core.boot.CSpec",
  "name": "healthStatusWatcher",
  "lazy": false,
  "enabled": true,
  "serviceClass": "foam.core.saf.HealthStatusWatcher"
})
```

## Graceful shutdown

1. **Take the instance out of the LB.** Touch `healthstatus/DRAIN`. `/service/health` returns 503
   and the LB stops sending new requests.
2. **Wait for idle.** Wait for in-flight requests and jobs to finish. An operator watches for
   this, or the script waits a fixed time.
3. **Shut down.** Touch `shutdown/SHUTDOWN`. The instance exits after the delay.
4. **Deploy and start** the new version. It starts as `DOWN`.
5. **Mark it ready.** When the instance is ready, for example when replay is complete, touch
   `healthstatus/UP`. The LB starts sending it traffic again.

## Behaviour to know

- **Only a new file counts.** A watcher reacts to a file being created. It deletes the file once
  it has handled the request, ready for the next one.
- **Files left while the instance is down are ignored.** A watcher sees only files created while
  it is running. At startup ShutdownWatcher deletes any leftover `SHUTDOWN` or `ABORT_SHUTDOWN`,
  so a new instance does not shut itself down and the next `touch` is seen.
- **Run `touch` as the instance's OS user.** The watcher deletes each file after handling it, and
  it cannot delete a file it has no permission on. Failed deletes are logged as warnings.
- **Instances can share a directory.** Two instances of the same application on one host, with the
  same hostname and temp directory, watch the same path, and one `touch` reaches both. Give each a
  different `-Dhostname` or `-Djava.io.tmpdir` to control them separately.
