<flow name="CrunchForDeveloper" category="DOC/DEV" spid="foam" description="CRUNCH developer internals: CrunchController, CapabilityIntercept, and throwing intercepts for subject capabilities." keywords="crunch,capabilityintercept,crunchcontroller,knowledge"/>

# CRUNCH Developer Documentation

## Purpose of this Document

This document aims to describe CRUNCH internals and interfaces, but is not
intended as a user guide. To get started with CRUNCH, see the documentation
in `src/documentation/crunch-doc.flow`.

## CrunchController

CrunchController contains logic for handling CRUNCH intercepts and
creating CRUNCH-specific wizard sequences. It should be provided by
the application's main controller in an exported property named
`crunchController`.

### CrunchController methods

<foam class="foam.flow.widgets.MethodShortSummary" of="foam.u2.crunch.CrunchController"></foam>

## CapabilityIntercept

Capability intercepts (AKA CRUNCH intercepts) allow a server to abort
a request and provide the client a list of capability IDs describing
capabilities the current subject must have. It may also return a
Capable object describing additional information the the object must
have to complete the request.

### Important Source Locations

- `foam.core.crunch.CapabilityIntercept` is an exception thrown
  when an action cannot be completed without CRUNCH requirements.
  When this exceptiono is thrown by the server, it results in an
  intercept which may re-send the failed request.
- `foam.core.crunch.box.CrunchClientReplyBox`
  handles an error response from the server
  iff it contains a CapabilityIntercept instance.
- `foam.box.Envelope` contains the check that a throwable is a
  RemoteException, which prevents the CrunchIntercept (which is one)
  from being double-wrapped.

### Example

## Server-Side: Throwing Intercept for Subject Capabilities

The following is a typical example of throwing an intercept for a
capability required by the `subject`. (note that `subject` has a
distinction from `user` - CRUNCH is capable or providing capabilities
for a user when "acting as" another user)

The following snippet will not invoke an intercept because it is run
as a script. If this code existed in a DAO decorator or a synchronous rule
it would result in the client handling the intercept for you before
re-sending (or aborting) the request.

```java
import foam.core.crunch.CapabilityIntercept;
var ex = new CapabilityIntercept();
ex.addCapabilityId("crunch.example");
throw ex;
```

## Client-Side: Handling a CapabilityIntercept

If a capability is thrown on the server it will usually be handled by
the client opaquely - that is, if you called `myDAO.put(...)` from the
client and it resulted in an intercept, the code calling `myDAO.put` is
oblivious to the intercept by design. Either the `put` will succeed
because required capabilities were satisfied by the user, or it will
fail because the user decided to abort the operation.

To better understand how intercepts work, this is how one would be
invoked manually on the client. Running this code snippet will result
in a wizard requesting the example capability, unless your current
user already has it granted.

<example>
var intercept = foam.core.crunch.CapabilityIntercept.create({
  capabilities: ['crunch.example']
});
x.crunchController.handleIntercept(intercept);
</example>
