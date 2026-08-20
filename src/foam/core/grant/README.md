# GRANT System Summary

## What is GRANT?

GRANT (Granular Rights And auThorization) is FOAM's newest authorization framework. It determines what users can and cannot do in the system by managing permissions efficiently and flexibly.

GRANT implements the same `AuthService` interface as FOAM's other authorization systems (UserAndGroupAuthService, CapabilityAuthService), so it can be used interchangeably or in combination with them. The `GrantAuthService` extends `ProxyAuthService`, allowing it to delegate to another AuthService for permissions not found in GRANT.

## Key Concepts

### Permissions

Permissions are dot-separated strings that represent specific capabilities:

```
document.read
document.write
admin.users.create
reports.export
```

Wildcards grant multiple permissions at once:
- `*` — Everything (superuser)
- `admin.*` — All admin permissions (admin.users, admin.config, etc.)

**Note:** `admin.*` grants `admin.users` but NOT `admin` itself.

### Grants

A Grant is an object that provides permissions. Grants are assigned to users and stored in the `grantDAO`. When a user logs in, all their grants are collected and combined into a single permission set for fast checking.

### Grant Types

| Grant Type | Purpose | Example Use Case |
|------------|---------|------------------|
| **PermissionGrant** | Single permission | `document.read` |
| **CompoundGrant** | Multiple grants combined | Role with several permissions |
| **SharedGrant** | Reference to another grant | Reusable role definitions |
| **PermissionedGrant** | Conditional permissions | "Grant X only if user has Y" |
| **SuperUserGrant** | All permissions | System administrators |
| **UserGrant** | Copy another user's permissions | SUDO-style access |
| **GroupGrant** | Permissions based on user's group | Group-based roles |
| **SPIDGrant** | Permissions based on service provider | Organization defaults |
| **ModuleGrant** | Tiered module access (1-3) | Analyst/Supervisor/Admin levels |
| **RecordingGrant** | Development tool | Discover required permissions |

### GrantAssignment

Grants are wrapped in `GrantAssignment` for storage. Key fields:

| Field | Purpose |
|-------|---------|
| `id` | Unique identifier |
| `name` | Human-readable name |
| `user` | User ID (0 = global, -1 = shareable template) |
| `spid` | Service Provider ID (empty = all SPIDs) |
| `grant` | The actual Grant object |

## How Permission Checking Works

```
User logs in
    ↓
Load all GrantAssignments for user
    ↓
Combine into single PermissionSet
    ↓
Evaluate conditions (snapshot)
    ↓
Cache result
    ↓
All permission checks use cached set
```

Permission checks are fast (O(depth) where depth is the number of dots in the permission string).

## Common Patterns

### Assigning a Simple Permission

```javascript
grantDAO.put(foam.core.grant.GrantAssignment.create({
  name: 'DocumentReader',
  user: userId,
  grant: foam.core.grant.PermissionGrant.create({
    permission: 'document.read'
  })
}));
```

### Creating a Role

```javascript
grantDAO.put(foam.core.grant.GrantAssignment.create({
  name: 'AnalystRole',
  user: userId,
  grant: foam.core.grant.CompoundGrant.create({
    grants: [
      foam.core.grant.PermissionGrant.create({ permission: 'data.read' }),
      foam.core.grant.PermissionGrant.create({ permission: 'reports.view' }),
      foam.core.grant.PermissionGrant.create({ permission: 'reports.export' })
    ]
  })
}));
```

### Reusable Role Definition

```javascript
// Define once (user: 0 means shared)
grantDAO.put(foam.core.grant.GrantAssignment.create({
  id: 'role-analyst',
  name: 'AnalystRoleDefinition',
  user: 0,
  grant: foam.core.grant.CompoundGrant.create({ ... })
}));

// Assign to users via reference
grantDAO.put(foam.core.grant.GrantAssignment.create({
  name: 'AnalystRole',
  user: userId,
  grant: foam.core.grant.SharedGrant.create({ grantId: 'role-analyst' })
}));
```

### SPID-Wide Permission

```javascript
// All users in 'acme' SPID get this permission
grantDAO.put(foam.core.grant.GrantAssignment.create({
  name: 'AcmeAccess',
  user: 0,
  spid: 'acme',
  grant: foam.core.grant.PermissionGrant.create({
    permission: 'acme.portal.*'
  })
}));
```

## Module System

Modules provide tiered access to functional areas. The default levels are:

| Level | Default Name | Typical Access |
|-------|--------------|----------------|
| 1 | Analyst | Read-only, basic operations |
| 2 | Supervisor | Approvals, oversight |
| 3 | Admin | Full configuration |

Level names can be customized when creating a Module in the moduleDAO to match your organization's terminology.

Modules require two-tier authorization:
1. **Service Provider** must have the module enabled
2. **User** must have a level assigned in that module

## Security Rules

The grantDAO has authorization rules to prevent privilege escalation:

| Grant Type | Who Can Create/Modify |
|------------|----------------------|
| Global (user = 0) | Super users only |
| SPID-based | Super users only |
| Shareable (user = -1) | Super users only |
| Non-ModuleGrant types | Super users only |
| User-specific ModuleGrants | Users with access to that user |

## Debugging Tools

### RecordingGrant

Discover what permissions a workflow needs:

```javascript
// 1. Assign RecordingGrant to test user
// 2. Perform the workflow
// 3. Export recorded permissions

recorder.showRecording();  // Log to console
recorder.copyToClipboard(); // Copy as FOAM code
recorder.toCompoundGrant(); // Get as Grant object
```

### Viewing User Permissions

```javascript
// Get all permissions for a user
var permissions = auth.getUserPermissions(x, user);
console.log(permissions.toStringPermissions());
```

## Quick Reference

| Task | How |
|------|-----|
| Check a permission | `auth.check(x, 'permission.name')` |
| Check for another user | `auth.checkUser(x, user, 'permission.name')` |
| Grant a permission | Put GrantAssignment to grantDAO |
| Remove a permission | Remove GrantAssignment from grantDAO |
| View all user permissions | `auth.getUserPermissions(x, user).toStringPermissions()` |
| Clear permission cache | `authService.purgeCache(userId)` |