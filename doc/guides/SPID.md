# FOAM Service Provider (SPID) System

The SPID (Service Provider ID) system provides multi-tenancy in FOAM3 by isolating data and permissions per service provider. This enables hosting multiple independent tenants in a single application instance with guaranteed data isolation.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPID SYSTEM ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐         implements          ┌─────────────────────────┐
  │  MyModel │ ───────────────────────────►│  ServiceProviderAware   │
  └──────────┘                             │  (interface)            │
                                           │  - spid property        │
                                           │  - GLOBAL_SPID = "*"    │
                                           └─────────────────────────┘
       │
       │ persisted in
       ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                    ServiceProviderAwareDAO                        │
  │  ┌────────────────────────────────────────────────────────────┐  │
  │  │  Automatic SPID Filtering:                                  │  │
  │  │  • put_()    → sets spid on create, checks permissions      │  │
  │  │  • find_()   → filters by serviceprovider.read.<spid>       │  │
  │  │  • select_() → adds SPID predicate to all queries           │  │
  │  │  • remove_() → checks serviceprovider.remove.<spid>         │  │
  │  └────────────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────┐         belongs to          ┌─────────────────────────┐
  │   User   │ ───────────────────────────►│   ServiceProvider       │
  │  (spid)  │                             │   (Capability)          │
  └──────────┘                             │  - inherentPermissions  │
                                           │  - setupSpid()          │
                                           │  - removeSpid()         │
                                           └─────────────────────────┘
```

## Making a Class SPID-Aware

To make a class SPID-aware, implement the `ServiceProviderAware` interface:

```javascript
foam.CLASS({
  package: 'com.example',
  name: 'MyModel',

  implements: [
    'foam.core.auth.ServiceProviderAware'
  ],

  properties: [
    // The 'spid' property is inherited automatically from the interface
    { class: 'String', name: 'name' },
    { class: 'Long', name: 'amount' }
    // ... your other properties
  ]
});
```

That's all you need. The interface provides:
- A `spid` property (Reference to `foam.core.auth.ServiceProvider`)
- A `GLOBAL_SPID` constant (`*`) for wildcard access
- An `isGlobalSpid()` method to check for global SPID

### Important: externalTransient

The `spid` property is defined with `externalTransient: true`:
- SPID is **not** persisted to storage
- SPID is **not** sent in network responses
- SPID is **computed at runtime** from context
- This prevents accidental SPID exposure in APIs/exports

## Core Classes

### ServiceProviderAware Interface

**Location:** `foam3/src/foam/core/auth/ServiceProviderAware.js`

```javascript
foam.INTERFACE({
  package: 'foam.core.auth',
  name: 'ServiceProviderAware',

  constants: [
    {
      name: 'GLOBAL_SPID',
      value: '*',
      type: 'String'
    }
  ],

  properties: [
    {
      class: 'Reference',
      of: 'foam.core.auth.ServiceProvider',
      name: 'spid',
      externalTransient: true
    }
  ]
});
```

### ServiceProvider Class

**Location:** `foam3/src/foam/core/auth/ServiceProvider.js`

`ServiceProvider` extends `Capability` and represents a tenant:

```javascript
foam.CLASS({
  package: 'foam.core.auth',
  name: 'ServiceProvider',
  extends: 'foam.core.crunch.Capability',

  properties: [
    {
      class: 'String',
      name: 'id',
      // Must be lowercase alphanumeric with dots/hyphens
      // e.g., "acme", "acme.corp", "my-tenant"
    },
    {
      name: 'inherentPermissions',
      // Automatically grants these permissions:
      // - serviceprovider.read.<spid>
      // - serviceproviderdao.read.<spid>
    },
    {
      class: 'Long',
      name: 'anonymousUser'
      // Reference to anonymous user for this SPID
    }
  ],

  methods: [
    // setupSpid(x, user) - Grants SPID capabilities to user
    // removeSpid(x, user) - Removes SPID capabilities from user
  ]
});
```

### ServiceProviderAwareDAO

**Location:** `foam3/src/foam/core/auth/ServiceProviderAwareDAO.js`

A DAO decorator that enforces SPID-based access control:

| Operation | Behavior |
|-----------|----------|
| `put_()` (create) | Sets SPID from context if not set; checks `serviceprovider.read.<spid>` |
| `put_()` (update) | Checks permissions; changing SPID requires `serviceprovider.update.*` |
| `find_()` | Filters by SPIDs user has `serviceprovider.read.<spid>` permission for |
| `select_()` | Adds SPID predicate to all queries automatically |
| `remove_()` | Checks `serviceprovider.remove.<spid>` or global permission |

## Permission System

### SPID Permissions

| Permission | Purpose |
|------------|---------|
| `serviceprovider.read.<spid>` | Read objects in this SPID |
| `serviceprovider.update.<spid>` | Modify SPID assignment of objects |
| `serviceprovider.remove.<spid>` | Delete objects in this SPID |
| `serviceprovider.read.*` | Global read access (bypasses all SPID filtering) |
| `serviceprovider.update.*` | Global update access |
| `serviceprovider.remove.*` | Global remove access |

### Automatic Permission Granting

When a `ServiceProvider` is created, it automatically grants:
- `serviceprovider.read.<spid>`
- `serviceproviderdao.read.<spid>`

These are defined in the `inherentPermissions` property.

## SPID Resolution

When creating a new SPID-aware object, the SPID is determined in this order:

1. **User's SPID** - If a user is in context and has a non-empty `spid`
2. **Theme's SPID** - If user has `spid.default.theme` permission or no user exists
3. **AuthorizationException** - If neither is available

```java
// From ServiceProviderAwareDAO.getSpid()
public String getSpid(X x) {
  // 1. Try user's SPID
  Subject subject = (Subject) x.get("subject");
  if ( subject != null && subject.getUser() != null ) {
    if ( ! SafetyUtil.isEmpty(subject.getUser().getSpid()) ) {
      return subject.getUser().getSpid();
    }
  }

  // 2. Try theme's SPID
  Theme theme = ((Themes) x.get("themes")).findTheme(x);
  if ( theme != null && ! SafetyUtil.isEmpty(theme.getSpid()) ) {
    return theme.getSpid();
  }

  // 3. No SPID found
  throw new AuthorizationException();
}
```

## Setting Up SPID-Aware DAOs

### Automatic Setup with EasyDAO

EasyDAO automatically adds `ServiceProviderAwareDAO` when the model implements `ServiceProviderAware`.

From EasyDAO.js:
```javascript
{
  name: 'serviceProviderAware',
  class: 'Boolean',
  javaFactory: 'return getOf().isAssignableTo(foam.core.auth.ServiceProviderAware.class);'
}
```

Standard services.jrl pattern:

```javascript
p({
  "class": "foam.core.boot.CSpec",
  "name": "myModelDAO",
  "serve": true,
  "serviceScript": """
    return new foam.dao.EasyDAO.Builder(x)
      .setSeqNo(true)
      .setOf(com.example.MyModel.getOwnClassInfo())
      .build();
  """
})
```

EasyDAO automatically:
- Detects that `MyModel` implements `ServiceProviderAware`
- Adds `ServiceProviderAwareDAO` to the decorator chain
- Adds an index on the `spid` property for performance

### Disabling Automatic SPID Filtering

To disable automatic SPID filtering for a specific DAO:

```javascript
return new foam.dao.EasyDAO.Builder(x)
  .setOf(com.example.MyModel.getOwnClassInfo())
  .setServiceProviderAware(false)
  .build();
```

### Manual Setup

When manually crafting a DAO stack (without EasyDAO):

```java
delegate = new foam.core.auth.ServiceProviderAwareDAO.Builder(x)
  .setDelegate(delegate)
  .build();
```

Note: Adding `ServiceProviderAwareDAO` manually when using EasyDAO results in double decoration since EasyDAO already adds it automatically.

### Decorator Chain

A typical SPID-aware DAO setup (created automatically by EasyDAO):

```
Request
   │
   ▼
┌──────────────────────────┐
│ ServiceProviderAwareDAO  │ ← SPID filtering (auto-added by EasyDAO)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    AuthorizationDAO      │ ← Permission checks
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│       MDAO / JDAO        │ ← Persistence
└──────────────────────────┘
```

## User-SPID Lifecycle

### 1. User Creation

```javascript
// User created without SPID
var user = User.create({
  email: 'john@example.com',
  firstName: 'John'
});
await userDAO.put(user);
// User initially sees data from their theme's SPID
```

### 2. SPID Assignment

```javascript
// Admin assigns SPID to user
user.spid = 'acme';
await userDAO.put(user);
// Triggers CreateUserCapabilityJunctionOnSpidSet rule
// Which calls ServiceProvider.setupSpid(x, user)
```

### 3. What setupSpid() Does

1. Gets the capability path for the ServiceProvider
2. Creates/updates `UserCapabilityJunction` records
3. Sets junction status to `GRANTED`
4. User now has `serviceprovider.read.acme` permission

### 4. SPID Change

```javascript
// Admin changes user's SPID
user.spid = 'newcorp';
await userDAO.put(user);
// 1. removeSpid() called for old SPID ('acme')
// 2. setupSpid() called for new SPID ('newcorp')
// User can now only see 'newcorp' data
```

## Context and SPID

The SPID can be accessed and manipulated in the execution context:

```java
// Get current SPID from context
String spid = (String) x.get("spid");

// Set SPID in context (for system operations)
X newContext = x.put("spid", "acme");

// Clear SPID (used during login)
X loginContext = x.put("spid", null);
```

### ResetSpidBeforeLoginAuthService

During login, the SPID is cleared to prevent SPID leakage:

```java
public class ResetSpidBeforeLoginAuthService {
  public User login(X x, String identifier, String password) {
    // Clear SPID during authentication
    return getDelegate().login(x.put("spid", null), identifier, password);
  }
}
```

## Global SPID (Wildcard)

The special SPID value `*` represents global/shared data:

```javascript
// Check if object has global SPID
if ( myObject.isGlobalSpid() ) {
  // Object is accessible to all tenants
}

// Set global SPID
myObject.spid = ServiceProviderAware.GLOBAL_SPID; // "*"
```

Objects with global SPID are visible to all users regardless of their assigned SPID.

## Examples of SPID-Aware Classes

Classes that implement `ServiceProviderAware` in FOAM3:

- `User` - Each user belongs to a specific SPID
- `Theme` - Themes are scoped per SPID
- `Ticket` - Support tickets isolated by SPID
- `Flow` - Business flows per tenant
- `Rule` - Business rules can be SPID-specific
- `Menu` - Menus can be customized per SPID

## Predicate Helpers

### IsSpid Predicate

Used in rules/queries to check user's SPID:

```javascript
foam.CLASS({
  package: 'foam.core.crunch.predicate',
  name: 'IsSpid',

  properties: [
    {
      class: 'StringArray',
      name: 'spids'
    }
  ]
});

// Usage in a rule
{
  predicate: {
    class: 'foam.core.crunch.predicate.IsSpid',
    spids: ['acme', 'newcorp']
  }
}
```

### ServiceProviderAwarePredicate

Wraps predicates to add SPID filtering for related objects:

```javascript
foam.CLASS({
  package: 'foam.core.auth',
  name: 'ServiceProviderAwarePredicate',
  extends: 'foam.mlang.predicate.AbstractPredicate'
});
```

## Best Practices

1. **Implement ServiceProviderAware** for tenant-specific data models
2. **EasyDAO handles SPID automatically** - detects the interface and adds `ServiceProviderAwareDAO`
3. **SPID is externalTransient** - computed at runtime, not persisted or sent over the network
4. **Global SPID (`*`)** is for shared data accessible to all tenants
5. **Theme SPID** provides fallback for unauthenticated access scenarios

## Debugging SPID Issues

Common issues and solutions:

| Issue | Cause | Solution |
|-------|-------|----------|
| AuthorizationException on create | No SPID in context | User needs SPID assigned, or theme needs SPID configured |
| User can't see data | Missing `serviceprovider.read.<spid>` | Check UserCapabilityJunction for the user |
| Data visible across tenants | Model missing `ServiceProviderAware` | Model needs `implements: ['foam.core.auth.ServiceProviderAware']` |
| Data visible across tenants (manual DAO) | Missing ServiceProviderAwareDAO | Relevant when manually crafting DAO stack without EasyDAO |
| SPID not set on new objects | Context SPID empty | User SPID or theme SPID needs to be set |

## Related Documentation

- [Auth.md](Auth.md) - Authentication and authorization overview
- [Permissions.md](Permissions.md) - Permission system details
- [Services.md](Services.md) - Service configuration
- [EasyDao.md](EasyDao.md) - DAO builder patterns
