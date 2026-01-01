## Nano-Service Architecture Summary

FOAM's nano-service architecture enables fine-grained services that can be co-located or distributed without code changes. This is achieved through several key mechanisms:

### 1. Location-Transparent Service Access

Services are accessed through dependency injection via the context system. When you import a service, you simply declare what you need without specifying where it comes from:

```javascript
imports: [
  'userService'  // Could be local or remote
]
```

The service can be local (same JVM) or remote (network call), and your code remains identical.

### 2. Stub/Skeleton Pattern for Transparency

FOAM uses a **stub/skeleton RPC system** to make network boundaries invisible:

- **Skeleton**: Server-side component that receives network messages and converts them to method calls
- **Stub**: Client-side proxy that marshals method calls into network requests

From the client's perspective, calling a remote service looks identical to calling a local one.

### 3. Box-Based Messaging Abstraction

The underlying network abstraction is **Box-based messaging** , which provides a minimal, send-only interface. Boxes can be:

- **Local**: Direct in-memory communication (same JVM)
- **Remote**: Network transport via HTTPBox, WebSocketBox, or SocketBox

The same service interface works with any box type.

### 4. Configuration-Driven Deployment

Services are configured in `.jrl` files using `CSpec` objects. The same service definition can be deployed:

- **Locally**: Service runs in the same JVM, accessed directly
- **Remotely**: Service runs on another server, accessed via HTTP/WebSocket

The client configuration determines whether the service is local or remote.

### 5. Remote Object Support

FOAM supports **remoting arbitrary objects** across the network using the `Remote` interface. Instead of serializing objects, FOAM creates a ClientStub that calls back to a ServerSkeleton, enabling peer-to-peer communication patterns.

## Key Benefits

1. **Zero networking overhead** when services are co-located in the same JVM
2. **Reduced administrative overhead** - multiple nano-services can share a single server process
3. **Transparent distribution** - services can be moved between local and remote without code changes
4. **Multiple transport options** - HTTP, WebSocket, or raw sockets
5. **Fine-grained decomposition** - services can be smaller since deployment overhead is minimal

## Notes

The architecture achieves this through FOAM's context system and box-based messaging abstraction. Services are defined once and can be deployed locally or remotely based purely on configuration. The stub/skeleton pattern ensures that client code never needs to know whether a service is local or remote, making the network boundary completely transparent.

### Purpose of Dependency Injection
Declares that you want a **live instance** of a service or value for use in your class. This is **dependency injection** or **inversion of control**.

**You get runtime objects/services, not classes.**

### Conceptual Model
Instead of your class going fishing around the system looking for services (which leads to complexity and tight-coupling), you simply declare what services you want to import and they're provided to you - even possibly from across the network.

This follows the **dependency injection** pattern:
- **Don't ask for dependencies** - declare what you need
- **Dependencies are injected** into your class at runtime
- **Loose coupling** - your class doesn't know where dependencies come from
