<flow name="be:services" category="DOC/EXAMPLES" spid="foam" description="Live examples of FOAM services: business logic, client/server RPC and the four components that make up a complete service." keywords="services,rpc,boxes,skeleton,client,fbe,example,knowledge"/>

<tocconfig index></tocconfig>

# FOAM Services By Example

FOAM services implement business logic and coordinate between DAOs. Services provide a clean abstraction for remote procedure calls, allowing client code to call server methods as if they were local.

<toc></toc>

## Overview

A complete FOAM service consists of four components:

| Component | Purpose | File |
|-----------|---------|------|
| Interface | Defines the contract | [PlaceService.js](https://github.com/kgrgreer/foam3/blob/development/src/foam/core/place/PlaceService.js) |
| Registration | Configures client-server communication | [services.jrl](https://github.com/kgrgreer/foam3/blob/development/src/foam/core/place/services.jrl) |
| Client | Proxy that forwards calls to server | [ClientPlaceService.js](https://github.com/kgrgreer/foam3/blob/development/src/foam/core/place/ClientPlaceService.js) |
| Implementation | Server-side business logic | [GooglePlaceService.js](https://github.com/kgrgreer/foam3/blob/development/src/foam/core/place/google/GooglePlaceService.js) |

### When to Use Services vs DAOs

| Use Case | Mechanism |
|----------|-----------|
| CRUD operations on data | DAO |
| Complex business logic | Service |
| Operations spanning multiple DAOs | Service |
| External API integration | Service |
| Stateless request/response | Service |

## Service Interface Definition

The interface defines the contract that all implementations must follow. It specifies method signatures, return types, and whether methods are asynchronous.

**Source:** [PlaceService.js](https://github.com/kgrgreer/foam3/blob/development/src/foam/core/place/PlaceService.js)

<example id="service-interface">
foam.INTERFACE({
  package: 'foam.core.place',
  name: 'PlaceService',

  skeleton: true,  // Generates server-side skeleton class automatically

  methods: [
    {
      name: 'placeAutocomplete',
      async: true,  // Method returns Promise
      args: 'Context x, String input, String preferCountry',
      type: 'foam.core.place.PlaceAutocompleteResp'  // Return type
    },
    {
      name: 'placeDetail',
      async: true,
      args: 'Context x, String placeId',
      type: 'foam.core.place.PlaceDetailResp'
    }
  ]
});

log('PlaceService interface defined');
</example>

### Interface Properties

| Property | Purpose |
|----------|---------|
| `package` | Namespace for the service |
| `name` | Service interface name |
| `skeleton: true` | Auto-generates `PlaceServiceSkeleton` class for server |
| `methods` | Service operations with signatures and return types |

### Method Properties

| Property | Purpose |
|----------|---------|
| `async: true` | Enables Promise-based calls |
| `args` | Method parameters (`Context x` is always first) |
| `type` | Return type specification |

---

## Service Registration

The <term term="CSpec"></term> configures the service for client-server communication, specifying authentication requirements, transport mechanism, and implementation class.

**Source:** [services.jrl](https://github.com/kgrgreer/foam3/blob/development/src/foam/core/place/services.jrl)

<example id="service-registration">
p({
  "class": "foam.core.boot.CSpec",
  "name": "placeService",
  "authenticate": true,  // Requires authentication
  "serve": true,         // Expose as server endpoint
  "boxClass": "foam.core.place.PlaceServiceSkeleton",  // Auto-generated skeleton
  "serviceClass": "foam.core.place.google.GooglePlaceService",  // Java implementation
  "client": {
    "class": "foam.core.place.ClientPlaceService",  // Client-side proxy
    "delegate": {
      "class": "foam.box.HTTPBox",  // HTTP transport
      "url": "service/placeService"  // Service URL endpoint
    }
  }
});

log('PlaceService registration configured');
</example>

### Registration Properties

| Property | Purpose |
|----------|---------|
| `name` | Service identifier for dependency injection |
| `authenticate` | Security requirement |
| `serve` | Makes service available over network |
| `boxClass` | Server-side message handler (auto-generated from `skeleton: true`) |
| `serviceClass` | Concrete implementation class |
| `client` | Client-side configuration |

### Client Configuration

The client configuration uses the <term term="Stub"></term> pattern with an <term term="HTTPBox"></term> for transport:

| Property | Purpose |
|----------|---------|
| `class` | Client proxy class |
| `delegate.class` | Transport mechanism (`HTTPBox` for HTTP) |
| `delegate.url` | Service URL endpoint |

---

## Client Implementation

The client creates a proxy that automatically forwards method calls to the server. The <term term="Stub"></term> property class handles all serialization and network communication.

**Source:** [ClientPlaceService.js](https://github.com/kgrgreer/foam3/blob/development/src/foam/core/place/ClientPlaceService.js)

<example id="client-implementation">
foam.CLASS({
  package: 'foam.core.place',
  name: 'ClientPlaceService',

  implements: ['foam.core.place.PlaceService'],  // Must implement the service interface

  properties: [
    {
      class: 'Stub',  // Special property class that creates method proxies
      of: 'foam.core.place.PlaceService',  // Interface to proxy
      name: 'delegate'  // Will be set to HTTPBox from registration
    }
  ]
});

log('ClientPlaceService proxy defined');
</example>

### How the Client Works

1. `implements` ensures this class has all interface methods (`placeAutocomplete`, `placeDetail`)
2. The `Stub` property automatically generates proxy methods that forward calls to `delegate`
3. When you call `clientService.placeAutocomplete(...)`, the Stub:
   - Serializes the method call and arguments
   - Sends HTTP request via the `delegate` (HTTPBox)
   - Deserializes the response and returns it
4. `delegate` is set from the registration config, pointing to HTTPBox with the service URL

---

## Service Usage

Services are consumed in application code via <term term="imports"></term>. The `?` suffix makes the import optional, preventing failures if the service isn't available.

<example id="service-usage">
foam.CLASS({
  package: 'foam.demo',
  name: 'PlaceDemo',

  imports: [
    'placeService?'  // Import service (? makes it optional)
  ],

  methods: [
    {
      name: 'searchPlaces',
      code: async function(query) {
        if ( ! this.placeService ) {
          console.log('Place service not available');
          return;
        }

        try {
          // Call service method
          var result = await this.placeService.placeAutocomplete(
            this.__subContext__,
            query,
            'US'
          );

          console.log('Found places:', result.places);
          return result;

        } catch (error) {
          console.error('Place search failed:', error);
        }
      }
    }
  ]
});

log('Service usage example defined');
</example>

### Usage Patterns

| Pattern | Purpose |
|---------|---------|
| `imports: ['placeService?']` | Dependency injection with optional flag |
| `this.__subContext__` | Current context passed to service calls |
| `async/await` | Promise-based method calls |
| `try/catch` | Error handling for network/service failures |

---

## Error Handling

Services should handle errors gracefully. The client receives exceptions thrown by the server implementation.

### Common Error Patterns

| Pattern | Use Case |
|---------|----------|
| Return null/empty | No results found |
| Throw RuntimeException | Unexpected errors |
| Return error object | Expected failures with details |

```javascript
// Client-side error handling
try {
  var result = await this.myService.doSomething(this.__subContext__, args);
  if ( ! result ) {
    // Handle no results
  }
} catch (error) {
  if ( error.message.includes('PermissionDenied') ) {
    // Handle permission error
  } else {
    // Handle unexpected error
  }
}
```

---

## Testing Services

Services can be tested by mocking the delegate or using a local implementation.

```javascript
// Create a mock service for testing
foam.CLASS({
  name: 'MockPlaceService',
  implements: ['foam.core.place.PlaceService'],

  methods: [
    async function placeAutocomplete(x, input, preferCountry) {
      return foam.core.place.PlaceAutocompleteResp.create({
        places: [{ name: 'Test Place', id: 'test-123' }]
      });
    }
  ]
});

// Inject mock in tests
var ctx = baseContext.createSubContext({
  placeService: MockPlaceService.create()
});
```

---

## Summary

FOAM services provide:

| Feature | Benefit |
|---------|---------|
| **Type Safety** | Interface contracts ensure consistency |
| **Network Transparency** | Local/remote calls work identically |
| **Auto-generation** | <term term="Skeleton"></term> classes created automatically |
| **Dependency Injection** | Services injected via imports |
| **Authentication** | Built-in security integration |
| **Transport Abstraction** | HTTP, WebSocket, etc. supported |

## Complete Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Application   │     │  ClientService  │     │    HTTPBox      │
│                 │────▶│     (Stub)      │────▶│   (Transport)   │
│  imports:       │     │                 │     │                 │
│  ['placeService']    │  delegate ──────┘     │  url: service/  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                    HTTP Request
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Implementation │◀────│    Skeleton     │◀────│     Server      │
│                 │     │  (Auto-generated)│     │                 │
│  GooglePlace    │     │                 │     │  boxClass:      │
│  Service.java   │     │  Deserializes   │     │  ...Skeleton    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## See Also

- [FOAM FAQ](be:FAQ) — Service client configuration explained
- [CSpec documentation](cspec.md) — Service registration details

<glossary>
  <def term="CSpec" definition="Configuration specification for FOAM services. Defines how services are created, registered, and accessed."></def>
  <def term="Stub" definition="A property class that creates method proxies, automatically forwarding calls to a delegate (typically over the network)."></def>
  <def term="Skeleton" definition="Server-side handler that deserializes network requests and invokes the actual service implementation. Auto-generated when skeleton: true is set on an interface."></def>
  <def term="HTTPBox" definition="Transport mechanism that sends Box messages over HTTP. Used for client-server service communication."></def>
  <def term="WebSocketBox" definition="Transport mechanism using WebSocket for persistent connections. Enables server-push and real-time updates."></def>
  <def term="imports" definition="Dependency injection declarations that make services and other context values available to a class."></def>
  <def term="exports" definition="Context declarations that make values available to child components via dependency injection."></def>
  <def term="foam.INTERFACE" definition="Declares a service interface with method signatures. Use skeleton: true to auto-generate server skeleton."></def>
  <def term="async" definition="Method property indicating the method returns a Promise. Required for network service calls."></def>
  <def term="serve" definition="CSpec property that exposes the service as a network endpoint when true."></def>
  <def term="authenticate" definition="CSpec property requiring authentication before service access when true."></def>
  <def term="Context" definition="The first parameter of service methods (usually 'x'). Provides access to the current user, permissions, and other contextual data."></def>
</glossary>