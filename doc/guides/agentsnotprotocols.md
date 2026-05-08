# Agents Not Protocols

Author: Kevin Greer

*Based on Bill Joy's 2000 essay, extended through FOAM/CORE*

---

## How TCP/IP Won

Bill Joy — inventor of BSD Unix, vi, sockets, NFS, SPARC, and JINI — made an observation that the industry absorbed and then promptly forgot.

TCP/IP defeated the ISO protocol stack not because it was better specified, but because it was *running code*. ISO produced paper. TCP/IP shipped a binary. A paper protocol can be read twelve different ways by twelve different implementors; shared executable code behaves the same everywhere it runs. Incompatibility is a property of documents, not programs.

His conclusion in 2000: **publish agents, not protocols**.

---

## What a Mobile Agent Is

A mobile agent is code that moves across a network and executes at its destination. The idea is older than the web:

- **PostScript** — a document format that is also a complete programming language. A PostScript file doesn't describe a page; it *computes* one. Famously, a PostScript file could implement a compression algorithm in PostScript and then use it to compress the rest of its own contents. No spec upgrade required. No negotiation. The capability travelled with the document.
- **Java** — explicitly designed for network-mobile code. Write once, run anywhere was always about agents, not just portability.
- **JavaScript** — the agent that won. Every web page downloads its own behaviour.

James Gosling built NeWS (a PostScript-based windowing system) before building Java. The thread runs deep.

---

## What Went Wrong

REST, WebServices, and OpenAPI are paper protocols with extra steps.

You publish a specification. Clients read it and generate stubs. Subtle disagreements accumulate about error handling, authentication, pagination, versioning, and what exactly `null` means in field 7. Every client must be written, maintained, and kept synchronised with a spec that drifts. Every upgrade requires coordinating both sides. Every new capability requires a new protocol negotiation.

This is exactly the problem TCP/IP solved in 1983. The industry spent the 2000s solving it again, worse, and called it progress.

---

## The FOAM/CORE Answer

FOAM (Feature-Oriented Active Modeller) and its application server CORE (Context-Oriented Runtime Environment) take Joy's argument seriously as an engineering principle, not just a rhetorical point.

When a FOAM client needs to talk to a service, it does not consult a spec and write a stub. It downloads the client agent from the `CSpec` service registry and runs it. The server and client are defined together as a single unit. No wire protocol is ever specified, documented, or negotiated. **The agent is the protocol.**

```javascript
// The caller sees this — always, regardless of what's underneath
result = invoiceService.submit(invoice);
```

Not this:
```javascript
const res = await fetch('/api/v2/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(invoice)
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const result = await res.json();
```

The REST version has hardcoded opinions about the protocol version, authentication mechanism, serialization format, error signalling, and endpoint path. None of that is the caller's concern — but REST forces every one of those decisions into the calling code, where they calcify.

---

## The Full-Service Agent

Here is where FOAM goes beyond the client-stub model that most agent discussions stop at.

In some cases, the downloaded agent is not a stub that proxies calls to a server. It *is* the service — a complete, self-sufficient implementation that runs entirely on the client and never contacts the server at all.

A password strength checker has no reason to call home. An i18n message adapter, a currency formatter, a local validation service — these can be delivered to the client as fully working implementations. The caller invokes them exactly as they would invoke a remote service. The interface is identical. The agent just happens to need no network.

**You could never do this with REST.** A REST endpoint is, by definition, a remote call. There is no REST equivalent of "actually, run this locally." The protocol and the location are fused. In FOAM they are completely decoupled — the service is an object, and where it runs is a deployment decision, not an API contract.

This means a service can migrate across the network boundary over its lifetime:
- Start as a full server-side implementation
- Move to a cached client-side proxy as traffic grows
- Become a fully local client-side agent as the logic stabilises
- Return to the server if the logic needs privileged data

At no point does the calling code change. The caller asked for a service by name. What it got is none of its business.

---

## Polymorphism Is the Solution

This is the deepest point in Joy's argument, and the one most worth dwelling on.

The reason the agent model works is not the transport, the language, or the serialization format. It is that **you are calling a method on an object**. The caller has no idea whether `service.method(args)` runs locally, fetches from a cache, calls a remote Java server over WebSocket, batches with five other calls, retries on transient failure, runs fully offline, or encrypts its payload. All of those are polymorphic substitutions behind the same interface.

In FOAM, the following are all transparent DAO decorators — configuration decisions that the calling code never sees:

- Client-side caching with a configurable retention policy
- Pre-fetching and windowing for large result sets
- Retry and store-and-forward for unreliable connections
- Load balancing across server instances
- Sharding by key range
- Request batching
- Full offline-first operation
- Encryption and compression

A REST client must implement each of these itself, inconsistently, per application, in the calling code. In FOAM they are layers in a decorator stack, swapped in or out by configuration. The caller writes `dao.select()` and has no opinion about which of them are active.

This is what object-oriented network architecture actually looks like. Not resources and verbs. Objects and methods. The network is an implementation detail. Polymorphism is the solution.

---

## A Security Dividend

The agent model produces a significant security advantage that is worth making explicit, because it is not an add-on — it is a direct consequence of the architecture.

**No cookies, no CSRF.** FOAM session management does not use cookies. The session token is held in the FOAM context and attached to outbound messages by `SessionClientBox` at the messaging layer. This means there is no ambient credential that a browser will helpfully attach to any request that matches a domain. A classic CSRF attack — tricking a browser into making an authenticated request to a server it is already logged into — has nothing to attach to.

**XSS cannot reach the session.** If an attacker manages to inject HTML into a FOAM page containing a link or hidden request back to a REST endpoint, it does them no good. That connection carries no session token, no authentication, and no authorization. The session lives in the application's context object, not in a cookie jar that the browser manages on behalf of any script that asks.

**No inline scripts.** FOAM runs under a Content Security Policy that prohibits inline scripts. An XSS payload that injects a `<script>` tag or an `onclick` handler gets no execution. The attack surface for script injection is eliminated at the policy level.

Taken together: the attack chain that makes XSS dangerous against conventional web applications — inject script, script reads cookie, cookie authenticates request — is broken at every link. There is no cookie to read, no credential to steal, and no inline execution context to run the injected code in. These are not defences bolted onto the architecture; they fall out of it naturally.

---

## The Summary of the Summary

> Publish an agent, not a protocol.
> Code travels. Papers diverge.
> The second-best network call is one the caller doesn't know is happening.
> The best — and most reliable — is the one that never happens at all.

Slides: [here](https://docs.google.com/presentation/d/1rtZ5dvmY6d4aImRkdlbF8IfvXwMMM6WPiA_Bv16mI4I/edit?slide=id.g348851f7453_1_15#slide=id.g348851f7453_1_15)