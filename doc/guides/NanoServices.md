## Nano-Service Architecture Summary

FOAM's nano-service architecture enables **fine-grained services that can be co-located or distributed** without code changes [1](#2-0) . This is achieved through several key mechanisms:

### 1. Location-Transparent Service Access

Services are accessed through **dependency injection via the context system** [2](#2-1) . When you import a service, you simply declare what you need without specifying where it comes from [3](#2-2) :

```javascript
imports: [
  'userService'  // Could be local or remote
]
```

The service can be **local (same JVM)** or **remote (network call)**, and your code remains identical [4](#2-3) .

### 2. Stub/Skeleton Pattern for Transparency

FOAM uses a **stub/skeleton RPC system** to make network boundaries invisible [5](#2-4) :

- **Skeleton**: Server-side component that receives network messages and converts them to method calls [6](#2-5)
- **Stub**: Client-side proxy that marshals method calls into network requests [7](#2-6)

From the client's perspective, calling a remote service looks identical to calling a local one [1](#2-0) .

### 3. Box-Based Messaging Abstraction

The underlying network abstraction is **Box-based messaging** [8](#2-7) , which provides a minimal, send-only interface [9](#2-8) . Boxes can be:

- **Local**: Direct in-memory communication (same JVM)
- **Remote**: Network transport via HTTPBox, WebSocketBox, or SocketBox [10](#2-9)

The same service interface works with any box type [11](#2-10) .

### 4. Configuration-Driven Deployment

Services are configured in `.jrl` files using `CSpec` objects [12](#2-11) . The same service definition can be deployed:

- **Locally**: Service runs in the same JVM, accessed directly
- **Remotely**: Service runs on another server, accessed via HTTP/WebSocket [13](#2-12)

The client configuration determines whether the service is local or remote [14](#2-13) .

### 5. Remote Object Support

FOAM supports **remoting arbitrary objects** across the network using the `Remote` interface [15](#2-14) . Instead of serializing objects, FOAM creates a ClientStub that calls back to a ServerSkeleton [16](#2-15) , enabling peer-to-peer communication patterns.

## Key Benefits

1. **Zero networking overhead** when services are co-located in the same JVM<cite />
2. **Reduced administrative overhead** - multiple nano-services can share a single server process<cite />
3. **Transparent distribution** - services can be moved between local and remote without code changes [17](#2-16)
4. **Multiple transport options** - HTTP, WebSocket, or raw sockets [10](#2-9)
5. **Fine-grained decomposition** - services can be smaller since deployment overhead is minimal<cite />

## Notes

The architecture achieves this through FOAM's context system and box-based messaging abstraction. Services are defined once and can be deployed locally or remotely based purely on configuration. The stub/skeleton pattern ensures that client code never needs to know whether a service is local or remote, making the network boundary completely transparent.

### Citations

**File:** doc/guides/Services.md (L11-15)
```markdown
2. In your foam.INTERFACE, include the property "skeleton: true", which will cause a skeleton to be generated

A skeleton is a server component which receives network messages and then converts them into calls
to the server implementation. If the method has return values or throws exceptions, it is also
the skeleton's responsibility to then marshal these return values or exceptions back in the network response.
```

**File:** doc/guides/Services.md (L27-38)
```markdown
### CLIENT SIDE
4. Create stub for Service on the client side
Eg: https://github.com/foam-framework/foam3/blob/master/src/foam/core/auth/ClientAuthService.js,
or id you don't require any special client behaviour, just add the "client: true" property to your foam.INTERFACE.

A stub does the reverse job of the skeleton. It implements the provided interface, but when called, it marshals the method name and parameters into a network call which is then sent to the server to be received by the skeleton, and then subsequently, by the actual server implementation. The stub then parses the result created by the skeleton and converts them into method return values.

Client Code -> Service Client -> Stub -> Network -> Skeleton -> Service Server

But from the client's point of view, the stub/network/skeleton is transparent and it looks like they're just magically calling the server service directly:

Client Code -> Service Server
```

**File:** doc/guides/REQUIRES_VS_IMPORTS.md (L96-109)
```markdown
## `imports:` - Dependency Injection

### Purpose
Declares that you want a **live instance** of a service or value for use in your class. This is **dependency injection** or **inversion of control**.

**You get runtime objects/services, not classes.**

### Conceptual Model
Instead of your class going fishing around the system looking for services (which leads to complexity and tight-coupling), you simply declare what services you want to import and they're provided to you - even possibly from across the network.

This follows the **dependency injection** pattern:
- **Don't ask for dependencies** - declare what you need
- **Dependencies are injected** into your class at runtime
- **Loose coupling** - your class doesn't know where dependencies come from
```

**File:** doc/guides/REQUIRES_VS_IMPORTS.md (L252-265)
```markdown
  imports: [
    'userDAO',    // I need a user DAO - don't care where it comes from
    'log'         // I need logging - don't care how it's implemented
  ],

  methods: [
    function someMethod() {
      // Just use the injected dependencies
      this.userDAO.find(id).then(user => {
        this.log.info('Found user:', user.name);
      });
    }
  ]
});
```

**File:** doc/guides/REQUIRES_VS_IMPORTS.md (L333-351)
```markdown

### Network Services
`imports:` can work across networks:

```javascript
foam.CLASS({
  name: 'ClientView',

  imports: [
    'userService'  // Could be a remote service accessed over HTTP
  ],

  methods: [
    function loadUser() {
      // userService might be running on a different server
      return this.userService.getCurrentUser();
    }
  ]
});
```

**File:** src/foam/box/Boxes.flow (L5-5)
```text
<p>Boxes are the network abstraction within foam that higher level constructs are built upon.  The box interface is the minimal viable networking abstraction.  The box is a "send only" interface, rather than a classical read()/write() or Berkeley sockets, or Request/Response of HTTP and similar protocols.</p>
```

**File:** src/foam/box/Boxes.flow (L12-19)
```text
interface Box {
  void send(envelope: Envelope);
}

class Envelope {
  Object  message; // the contents of the envelope
  Box     replyBox; // where to send replies to this message, optional
}
```

**File:** src/foam/box/Boxes.flow (L22-22)
```text
<p>There are low level transport boxes like HTTPBox, WebSocketBox, SocketBox, that are responsible for delivering an envelope over their given transport, in some cases these are also responsible for handling any replies.  There are also higher level decorators that can be applied to boxes to achieve desired behaviours.  For example, if you need your message send to time out after a set time, you can apply a TimeoutBox.  Or if you want exponential backoff retry attempts for your send you can apply a Retry Box.</p>
```

**File:** src/foam/box/Boxes.flow (L42-50)
```text
<p>Boxes are primarily used to drive the Stub/Skeleton RPC system of FOAM.  For example, ClientDAO is a Stub DAO, it can be provided with a Box and will communicate over that Box to provide a DAO interface.</p>

<code>
var dao = foam.dao.ClientDAO.create({
  delegate: foam.box.WebSocketBox.create({  url: 'ws://someserver.com/service/someDAO' })
});

dao.put(some.Object.create({ ... }))
</code>
```

**File:** src/services.jrl (L212-226)
```text
p({
  "class":"foam.core.boot.CSpec",
  "name":"blobStore",
  "serviceClass":"foam.blob.BlobStore"
})

p({
  "class": "foam.core.boot.CSpec",
  "name": "httpBlobService",
  "authenticate": false,
  "serviceScript": """
    httpBlobService = new foam.core.blob.HttpBlobService(x, x.get("blobStore"));
    return new foam.core.http.SessionWebAgent("service.run.httpBlobService", httpBlobService);
  """
})
```

**File:** src/services.jrl (L253-258)
```text
  "client": """
    {
      "class":"foam.blob.RestBlobService",
      "serviceName":"service/httpBlobService"
    }
  """
```

**File:** src/foam/core/place/services.jrl (L24-31)
```text
  "client": """
      {
        "class":"foam.core.place.ClientPlaceService",
        "delegate": {
          "class": "foam.box.HTTPBox",
          "url": "service/placeService"
        }
      }
```

**File:** src/foam/box/Remote.js (L11-19)
```javascript
  documentation: `
    Marker interface for objects that can be remoted over the network.
    Remoted objects aren't Serialized when sent across the network,
    but are instead replaced with a ClientStub which calls back to
    a ServerSkeleton registered to receive network calls for the original
    Remote object.

    Useful for general P2P programming, but currently only used when
    performing dao.listen(sink) over a WebSocket.
```
