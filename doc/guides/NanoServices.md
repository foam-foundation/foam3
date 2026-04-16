<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [FOAM Nano-Services Architecture](#foam-nano-services-architecture)
  - [Overview](#overview)
  - [Core Concepts](#core-concepts)
    - [Location-Agnostic Service Access](#location-agnostic-service-access)
    - [The Service Contract](#the-service-contract)
  - [The Box Messaging Layer](#the-box-messaging-layer)
    - [What is a Box?](#what-is-a-box)
    - [The Envelope](#the-envelope)
    - [How Box, Envelope, and RPCMessage Connect](#how-box-envelope-and-rpcmessage-connect)
    - [Box Implementations](#box-implementations)
    - [Box Composition](#box-composition)
  - [Stub/Skeleton Pattern](#stubskeleton-pattern)
    - [How It Works](#how-it-works)
    - [The RPCMessage](#the-rpcmessage)
    - [Generated Code](#generated-code)
  - [Creating a Nano-Service](#creating-a-nano-service)
    - [Step 1: Define Request/Response Models](#step-1-define-requestresponse-models)
    - [Step 2: Define the Service Interface](#step-2-define-the-service-interface)
    - [Step 3: Implement the Server-Side Service](#step-3-implement-the-server-side-service)
    - [Step 4: Register the Service (CSpec)](#step-4-register-the-service-cspec)
    - [Step 5: Use the Service](#step-5-use-the-service)
  - [Service Registration (CSpec)](#service-registration-cspec)
    - [CSpec Properties](#cspec-properties)
    - [The Client Configuration](#the-client-configuration)
  - [Complete Example: NotificationService](#complete-example-notificationservice)
    - [1. Request/Response Models](#1-requestresponse-models)
    - [2. Service Interface](#2-service-interface)
    - [3. Server Implementation](#3-server-implementation)
    - [4. Service Registration (services.jrl)](#4-service-registration-servicesjrl)
    - [5. Client Usage](#5-client-usage)
  - [Key Benefits](#key-benefits)
    - [1. Zero Networking Overhead When Co-located](#1-zero-networking-overhead-when-co-located)
    - [2. Transparent Distribution](#2-transparent-distribution)
    - [3. Multiple Transport Options](#3-multiple-transport-options)
    - [4. Fine-Grained Decomposition](#4-fine-grained-decomposition)
    - [5. Composable Decorators](#5-composable-decorators)
    - [6. Type Safety](#6-type-safety)
  - [Summary](#summary)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# FOAM Nano-Services Architecture

FOAM's nano-service architecture enables fine-grained services that can be co-located or distributed without code changes. This document provides a comprehensive guide to understanding and building nano-services.

## Overview

FOAM's nano-service architecture solves a fundamental problem in distributed systems: how do you write code that works identically whether services are local (same JVM/process) or remote (across a network)?

The answer is **location agnostic** design through three mechanisms:

1. **Context-based dependency injection** - Services are accessed by name, not by direct instantiation
2. **Box-based messaging** - A minimal transport abstraction that hides network details
3. **Stub/Skeleton RPC** - Automatic generation of client proxies and server handlers
◊
```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Code                         │
│                                                                 │
│   imports: ['myAIService']                                      │
│   ...                                                           │
│   this.myAIService.chat(x, request)  // Same API everywhere     │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Local   │    │   HTTP   │    │ WebSocket│
    │  (same   │    │  (REST)  │    │  (real-  │
    │   JVM)   │    │          │    │   time)  │
    └──────────┘    └──────────┘    └──────────┘
```

The calling code never changes. The transport is a configuration detail.

---

## Core Concepts

### Location-Agnostic Service Access

Services are accessed through dependency injection via the context system:

```javascript
foam.CLASS({
  name: 'MyFeature',

  imports: [
    'calculatorService',  // Could be local or remote
    'storageService'      // Application doesn't know or care
  ],

  methods: [
    async function computeTotal(items) {
      // This call works identically whether the service is:
      // - In the same JVM (zero network overhead)
      // - On another server via HTTP
      // - On another server via WebSocket
      var result = await this.calculatorService.sum(this.__subContext__, items);
      return result;
    }
  ]
});
```

### The Service Contract

A nano-service is defined by a **FOAM Interface** with two special flags:

```javascript
foam.INTERFACE({
  package: 'com.example',
  name: 'CalculatorService',

  skeleton: true,  // Generate server-side message handler
  client: true,    // Generate client-side proxy

  methods: [
    {
      name: 'sum',
      async: true,
      type: 'Double',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'values', type: 'Double[]' }
      ]
    }
  ]
});
```

From this single interface definition, FOAM generates:
- `CalculatorServiceSkeleton` - Server-side class that receives messages and calls the real implementation
- `ClientCalculatorService` - Client-side proxy that marshals method calls into network requests

---

## The Box Messaging Layer

### What is a Box?

A **Box** is FOAM's fundamental transport abstraction. It has exactly one method:

```javascript
foam.INTERFACE({
  package: 'foam.box',
  name: 'Box',
  methods: [
    {
      name: 'send',
      type: 'Void',
      args: [
        { name: 'envelope', type: 'foam.box.Envelope' }
      ]
    }
  ]
});
```

That's it. A Box can only send. This simplicity is intentional - it's the minimal interface needed to abstract any transport mechanism.

### The Envelope

Messages are wrapped in an **Envelope** that carries the payload and a reply destination:

```javascript
foam.CLASS({
  package: 'foam.box',
  name: 'Envelope',
  properties: [
    {
      class: 'Object',
      name: 'message'      // The actual payload (RPC call, response, etc.)
    },
    {
      class: 'FObjectProperty',
      name: 'replyBox',    // Where to send the response
      of: 'foam.box.Box'
    }
  ]
});
```

### How Box, Envelope, and RPCMessage Connect

These three pieces form a layered message-passing system:

```
┌─────────────────────────────────────────────────────────┐
│                         Box                             │
│  - The transport interface                              │
│  - Has one method: send(envelope)                       │
│  - Knows HOW to deliver (HTTP, WebSocket, local, etc.)  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                    Envelope                       │  │
│  │  - The container/wrapper                          │  │
│  │  - Contains: message + replyBox                   │  │
│  │  - replyBox is another Box for the response       │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │              RPCMessage                     │  │  │
│  │  │  - The actual method call                   │  │  │
│  │  │  - Contains: name (method) + args           │  │  │
│  │  │  - Example: { name: "sum", args: [x, [1,2]] │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**The flow:**

1. **Client creates RPCMessage** - contains method name and arguments
2. **RPCMessage wrapped in Envelope** - adds a replyBox for the response
3. **Box.send(envelope)** - transport delivers the envelope
4. **Server extracts RPCMessage** - calls the actual method
5. **Response wrapped in new Envelope** - sent back via replyBox

This separation allows:
- **Box** to be swapped (HTTP ↔ WebSocket) without changing message format
- **Envelope** to handle request/response pairing via replyBox
- **RPCMessage** to remain a simple, serializable method call

### Box Implementations

Different Box classes handle different transports:

| Box Class | Transport | Use Case |
|-----------|-----------|----------|
| `HTTPBox` | HTTP POST | Standard request/response |
| `WebSocketBox` | WebSocket | Real-time, bidirectional |
| `RawWebSocketBox` | Raw WebSocket | Custom protocols |
| `SessionClientBox` | Decorator | Adds session ID to requests |
| `TimeoutBox` | Decorator | Adds request timeouts |
| `RetryBox` | Decorator | Automatic retry on failure |
| `NullBox` | No-op | Testing, fire-and-forget |

### Box Composition

Boxes compose like DAOs - wrap one with another to add behavior:

```javascript
// Client-side box chain:
{
  "class": "foam.box.SessionClientBox",     // Add session authentication
  "delegate": {
    "class": "foam.box.TimeoutBox",         // Add 30-second timeout
    "timeout": 30000,
    "delegate": {
      "class": "foam.box.HTTPBox",          // Actual transport
      "url": "service/calculatorService"
    }
  }
}
```

The service never knows about these layers. The Box interface is the only contract.

---

## Stub/Skeleton Pattern

### How It Works

The **Stub/Skeleton** pattern makes network boundaries invisible:

```
┌──────────────────┐                    ┌──────────────────┐
│     CLIENT       │                    │      SERVER      │
│                  │                    │                  │
│  Application     │                    │  Service Impl    │
│       │          │                    │       ▲          │
│       ▼          │                    │       │          │
│  ClientStub      │                    │   Skeleton       │
│  (generated)     │                    │  (generated)     │
│       │          │     Network        │       ▲          │
│       ▼          │                    │       │          │
│     Box ─────────┼────────────────────┼─────► Box        │
│                  │                    │                  │
└──────────────────┘                    └──────────────────┘
```

1. **Client calls method** on the stub (e.g., `calculatorService.sum(x, values)`)
2. **Stub marshals** the call into an `RPCMessage` with method name and arguments
3. **Box sends** the message over the configured transport
4. **Skeleton receives** the message and unmarshals it
5. **Skeleton calls** the real service implementation
6. **Response flows back** through the same chain in reverse

### The RPCMessage

Method calls are serialized as `RPCMessage` objects:

```javascript
foam.CLASS({
  package: 'foam.box',
  name: 'RPCMessage',
  properties: [
    { name: 'name' },    // Method name: "chat"
    { name: 'args' }     // Arguments: [context, chatRequest]
  ]
});
```

### Generated Code

When you set `skeleton: true` and `client: true` on an interface, FOAM generates:

**ClientCalculatorService** (client-side stub):
```javascript
// Generated - do not edit
foam.CLASS({
  package: 'com.example',
  name: 'ClientCalculatorService',
  implements: ['com.example.CalculatorService'],

  properties: [
    { class: 'FObjectProperty', of: 'foam.box.Box', name: 'delegate' }
  ],

  methods: [
    async function sum(x, values) {
      return new Promise((resolve, reject) => {
        this.delegate.send(foam.box.Envelope.create({
          message: foam.box.RPCMessage.create({
            name: 'sum',
            args: [x, values]
          }),
          replyBox: {
            send: function(envelope) {
              if (envelope.message instanceof foam.box.RPCErrorMessage) {
                reject(envelope.message.data);
              } else {
                resolve(envelope.message.data);
              }
            }
          }
        }));
      });
    }
  ]
});
```

**CalculatorServiceSkeleton** (server-side handler):
```java
// Generated - do not edit
package com.example;

public class CalculatorServiceSkeleton extends foam.box.AbstractSkeleton {

  protected foam.lang.XFactory delegateFactory_;

  public void send(foam.box.Envelope envelope) {
    if ( ! ( envelope.getMessage() instanceof foam.box.RPCMessage) ) {
      return;
    }

    foam.box.RPCMessage rpc = (foam.box.RPCMessage) envelope.getMessage();
    foam.lang.X         x   = envelope.getX();
    Object result = null;

    try {
      switch ( rpc.getName() ) {
        case "sum":
          result = ((CalculatorService) (getDelegateFactory().create(x))).sum(
            x,
            (Double[]) (rpc.getArgs() != null && rpc.getArgs().length > 1 ? rpc.getArgs()[1] : null));
          break;

        default: throw new RuntimeException("Method not found.");
      }
    } catch (Throwable t) {
      envelope.replyWithException(t);
      return;
    }

    if ( envelope.getReplyBox() != null ) {
      foam.box.RPCReturnMessage reply = (foam.box.RPCReturnMessage)
        getX().create(foam.box.RPCReturnMessage.class);
      if ( result != null ) reply.setData(result);
      envelope.getReplyBox().send(new foam.box.Envelope(reply, null));
    }
  }
}
```

---

## Creating a Nano-Service

### Step 1: Define Request/Response Models

Define the data structures your service will use:

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'SearchRequest',

  properties: [
    { class: 'String', name: 'query' },
    { class: 'Int', name: 'maxResults', value: 10 }
  ]
});

foam.CLASS({
  package: 'com.example',
  name: 'SearchResult',

  properties: [
    { class: 'String', name: 'title' },
    { class: 'String', name: 'snippet' },
    { class: 'Double', name: 'score' }
  ]
});

foam.CLASS({
  package: 'com.example',
  name: 'SearchResponse',

  properties: [
    {
      class: 'FObjectArray',
      name: 'results',
      of: 'com.example.SearchResult'
    }
  ]
});
```

### Step 2: Define the Service Interface

```javascript
foam.INTERFACE({
  package: 'com.example',
  name: 'SearchService',

  skeleton: true,  // Generate skeleton
  client: true,    // Generate client stub

  documentation: 'Service for performing searches',

  methods: [
    {
      name: 'search',
      documentation: 'Search for documents matching the query',
      async: true,
      type: 'com.example.SearchResponse',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'request', type: 'com.example.SearchRequest' }
      ]
    }
  ]
});
```

### Step 3: Implement the Server-Side Service

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'ServerSearchService',
  implements: ['com.example.SearchService'],

  javaImports: [
    'java.util.ArrayList',
    'java.util.List'
  ],

  properties: [
    {
      class: 'String',
      name: 'indexPath',
      documentation: 'Path to the search index'
    }
  ],

  methods: [
    {
      name: 'search',
      javaCode: `
        List<SearchResult> results = new ArrayList<>();

        // Your search implementation here
        // ...

        SearchResponse response = new SearchResponse();
        response.setResults(results.toArray(new SearchResult[0]));
        return response;
      `
    }
  ]
});
```

### Step 4: Register the Service (CSpec)

Create a `services.jrl` file:

```javascript
p({
  "class": "foam.core.boot.CSpec",
  "name": "searchService",
  "serve": true,
  "authenticate": true,
  "boxClass": "com.example.SearchServiceSkeleton",
  "serviceScript": """
    return new com.example.ServerSearchService(x)
      .setIndexPath("/var/search/index");
  """,
  "client": """
    {
      "class": "com.example.ClientSearchService",
      "delegate": {
        "class": "foam.box.SessionClientBox",
        "delegate": {
          "class": "foam.box.HTTPBox",
          "url": "service/searchService"
        }
      }
    }
  """
})
```

### Step 5: Use the Service

```javascript
foam.CLASS({
  name: 'SearchView',
  extends: 'foam.u2.View',

  imports: ['searchService'],

  requires: ['com.example.SearchRequest'],

  methods: [
    async function doSearch(query) {
      var request = this.SearchRequest.create({ query: query });
      var response = await this.searchService.search(this.__subContext__, request);
      return response.results;
    }
  ]
});
```

---

## Service Registration (CSpec)

### CSpec Properties

| Property | Purpose |
|----------|---------|
| `name` | Service name (how it's accessed in context) |
| `serve` | Whether to expose via network |
| `authenticate` | Require valid session |
| `boxClass` | The skeleton class name |
| `serviceScript` | Server-side instantiation code |
| `client` | Client-side configuration |
| `lazy` | Create on first access (default: true) |

### The Client Configuration

The `client` block defines what gets created on the client side:

```javascript
"client": """
  {
    "class": "com.example.ClientCalculatorService",
    "delegate": {
      "class": "foam.box.SessionClientBox",
      "delegate": {
        "class": "foam.box.HTTPBox",
        "url": "service/calculatorService"
      }
    }
  }
"""
```

This creates a client stub wrapping a session-aware HTTP box.

---

## Complete Example: NotificationService

Here's a complete example showing all the pieces together for a notification service:

### 1. Request/Response Models

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'NotifyRequest',
  properties: [
    { class: 'String', name: 'userId' },
    { class: 'String', name: 'message' },
    { class: 'String', name: 'channel', value: 'email' }  // email, sms, push
  ]
});

foam.CLASS({
  package: 'com.example',
  name: 'NotifyResponse',
  properties: [
    { class: 'Boolean', name: 'success' },
    { class: 'String', name: 'messageId' }
  ]
});
```

### 2. Service Interface

```javascript
foam.INTERFACE({
  package: 'com.example',
  name: 'NotificationService',

  skeleton: true,
  client: true,

  documentation: 'Service for sending notifications across channels',

  methods: [
    {
      name: 'notify',
      async: true,
      type: 'com.example.NotifyResponse',
      args: [
        { name: 'x', type: 'Context' },
        { name: 'request', type: 'com.example.NotifyRequest' }
      ]
    }
  ]
});
```

### 3. Server Implementation

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'ServerNotificationService',
  implements: ['com.example.NotificationService'],

  methods: [
    {
      name: 'notify',
      javaCode: `
        // Route to appropriate channel handler
        String channel = request.getChannel();
        boolean success = false;
        String messageId = java.util.UUID.randomUUID().toString();

        if ( "email".equals(channel) ) {
          // Send email...
          success = true;
        } else if ( "sms".equals(channel) ) {
          // Send SMS...
          success = true;
        }

        NotifyResponse response = new NotifyResponse();
        response.setSuccess(success);
        response.setMessageId(messageId);
        return response;
      `
    }
  ]
});
```

### 4. Service Registration (services.jrl)

```javascript
p({
  "class": "foam.core.boot.CSpec",
  "name": "notificationService",
  "serve": true,
  "authenticate": true,
  "boxClass": "com.example.NotificationServiceSkeleton",
  "serviceScript": """
    return new com.example.ServerNotificationService(x);
  """,
  "client": """
    {
      "class": "com.example.ClientNotificationService",
      "delegate": {
        "class": "foam.box.SessionClientBox",
        "delegate": {
          "class": "foam.box.HTTPBox",
          "url": "service/notificationService"
        }
      }
    }
  """
})
```

### 5. Client Usage

```javascript
foam.CLASS({
  name: 'AlertManager',

  imports: ['notificationService'],

  requires: ['com.example.NotifyRequest'],

  methods: [
    async function sendAlert(userId, message) {
      var request = this.NotifyRequest.create({
        userId: userId,
        message: message,
        channel: 'email'
      });

      var response = await this.notificationService.notify(
        this.__subContext__,
        request
      );

      return response.success;
    }
  ]
});
```

---

## Key Benefits

### 1. Zero Networking Overhead When Co-located

When services run in the same JVM, there's no serialization, no network round-trip. The "Box" is just a direct method call.

### 2. Transparent Distribution

Move a service to another server by changing the CSpec. No application code changes required.

### 3. Multiple Transport Options

HTTP, WebSocket, or raw sockets - the Box abstraction supports all of them interchangeably.

### 4. Fine-Grained Decomposition

Services can be arbitrarily small because deployment overhead is minimal. Multiple nano-services can share a single server process.

### 5. Composable Decorators

Add authentication, timeouts, retries, logging by wrapping Boxes - no code changes to the service itself.

### 6. Type Safety

Request and response types are FOAM models - automatically validated, serialized, and documented.

---

## Summary

FOAM nano-services provide:

- **Single interface definition** generates both client and server code
- **Box abstraction** hides transport details (HTTP, WebSocket, local)
- **Stub/Skeleton pattern** makes remote calls look like local calls
- **CSpec configuration** controls deployment without code changes
- **Decorator composition** adds cross-cutting concerns transparently

The key insight: services are objects, not endpoints. The transport is configuration, not API design.
