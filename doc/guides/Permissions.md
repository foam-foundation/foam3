# FOAM Permissions

## Permission System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERMISSION CHECK FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐
  │   User   │ ─────────────────────────┐
  └────┬─────┘                          │
       │ belongs to                     │ owns (CRUNCH)
       ▼                                ▼
  ┌──────────┐                   ┌─────────────────┐
  │  Group   │                   │   Capability    │
  └────┬─────┘                   │  (can expire)   │
       │ has many                └────────┬────────┘
       ▼                                  │ grants
  ┌───────────────────┐                   │
  │ GroupPermission   │                   │
  │    Junction       │                   │
  └────────┬──────────┘                   │
           │ links to                     │
           ▼                              ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                         Permission                               │
  │  ┌─────────────────────────────────────────────────────────┐    │
  │  │  Permission String Patterns:                             │    │
  │  │                                                          │    │
  │  │  • *                        → Global (do anything)       │    │
  │  │  • service.<name>           → Service access             │    │
  │  │  • <model>.read.<id>        → Read object                │    │
  │  │  • <model>.create           → Create object              │    │
  │  │  • <model>.update.<id>      → Update object              │    │
  │  │  • <model>.remove.<id>      → Delete object              │    │
  │  │  • <model>.ro.<property>    → Read property              │    │
  │  │  • <model>.rw.<property>    → Write property             │    │
  │  │  • <model>.column.<prop>    → View table column          │    │
  │  │  • @<RoleName>              → Inherit Role's permissions │    │
  │  └─────────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTH SERVICE DECORATOR CHAIN                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Request → PMAuthService → CachingAuthService → CapabilityAuthService      │
│               │                    │                      │                 │
│               ▼                    ▼                      ▼                 │
│          (monitoring)         (caching)            (CRUNCH check)           │
│                                                          │                  │
│             EnabledCheckAuthService ← PasswordExpiryAuthService             │
│                      │                        │                             │
│                      ▼                        ▼                             │
│              (user enabled?)          (password expired?)                   │
│                                                                             │
│                    TwoFactorAuthService → UserAndGroupAuthService           │
│                            │                        │                       │
│                            ▼                        ▼                       │
│                      (2FA check)           (Group permissions)              │
│                                                     │                       │
│                                                     ▼                       │
│                                              ✓ GRANTED / ✗ DENIED           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              ROLE INHERITANCE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────┐      @OpsRole       ┌───────────────┐                   │
│   │  AdminGroup   │ ──────────────────► │   OpsRole     │ (Role Group)      │
│   │               │      inherits       │  (no users)   │                   │
│   │ permissions:  │                     │ permissions:  │                   │
│   │  - user.*     │                     │  - report.*   │                   │
│   │  - @OpsRole   │◄────────────────────│  - audit.*    │                   │
│   └───────────────┘   gets all perms    └───────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Overview

Permissions in FOAM represent access to system resources and follow Java's hierarchical naming convention. [1](#1-0)  The system uses wildcard matching where an asterisk can appear by itself or at the end of a name preceded by a dot to signify wildcard matches.

## Permission Naming Convention

**Valid wildcard patterns:**
- `*` - Global permission (ability to do anything)
- `foo.*` - Hierarchical wildcard

**Invalid patterns:**
- `*foo`, `a*b`, `foo*` - Asterisk not at end or not preceded by dot

**Examples:**
- `*` - Ability to do anything, granted to 'admin' group
- `user.read.*` - Ability to read all Users from the UserDAO
- `theme.write.acme` - Ability to write only the 'acme' Theme from the ThemeDAO

## Permission Checking

### Primary Interface
```
boolean foam.core.auth.AuthService.check(X x, String permission)
```

### Main Implementation
`UserAndGroupAuthService` serves as the primary implementation, decorated with multiple service layers:

- **CapabilityAuthService** - CRUNCH capability integration
- **EnabledCheckAuthService** - User enabled status validation
- **PasswordExpiryAuthService** - Password expiration checks
- **TwoFactoryAuthService** - Two-factor authentication
- **ResetSpidBeforeLoginAuthService** - Service provider context reset
- **CachingAuthService** - ⚠️ **Critical for performance**
- **SubjectAuthService** - Subject context management
- **PMAuthService** - Performance monitoring
- **SystemAuthService** - System-level permissions
- **FailedLoginAuthService** - Failed login attempt tracking

## Core Data Models

### Authentication Models
- **User** - System users (humans or computer systems) [2](#1-1)
- **Group** - User collections; each user belongs to one group [3](#1-2)
- **Permission** - Documented permissions shown in Permission Matrix [4](#1-3)
- **GroupPermissionJunction** - Many-to-many Group↔Permission relationship [5](#1-4)

### CRUNCH Models
- **Capability** - User-owned "contracts" that grant permissions, can expire, hierarchical [6](#1-5)
- **UserCapabilityJunction** - Many-to-many User↔Capability relationship

## Permission Patterns

### 1. Service Access
- **Pattern:** `service.<serviceName>`
- **Example:** `service.userDAO`
- **Implementer:** CSpec.js
- **Note:** Grants connection access but not operational permissions

### 2. WebAgent Execution
- **Pattern:** `service.run.<serviceName>`
- **Examples:** `service.run.Health`, `service.run.uptime`
- **Implementer:** NanoRouter.java
- **Note:** Separate from service access (probably a mistake)

### 3. DAO Object Operations
- **Pattern:** `<permissionPrefix>.<operation>.<id>`
  - `permissionPrefix = toLowerCase(model.name)`
  - Operations: `read`, `remove`, `create`, `update`
- **Examples:** `menu.read.settings`, `email.create`, `notificationsetting.remove.*`
- **Implementer:** `foam.core.auth.AuthorizationDAO`, `foam.core.auth.StandardAuthorizer` [7](#1-6)
- **Notes:**
  - `create` operations don't include `<id>`
  - ~50% of all permissions follow the `<prefix>.read.<id>` pattern
  - Alternative authorizers available: `AuthorizableAuthorizer`, `GlobalCreateAuthorizer`, etc.

### 4. Property-Level Access
- **Pattern:** `<modelName>.<ro|rw>.<propertyName>`
- **Examples:** `theme.rw.loginimage`, `user.ro.compliance`
- **Implementer:** `AbstractPropertyInfo.java`, `PermissionedPropertyDAO.js` [8](#1-7)
- **Configuration:** Must be explicitly enabled in model:
  ```javascript
  writePermissionRequired: true
  readPermissionRequired: true
  updatePermissionRequired: true
  ```

### 5. Action Permissions
- **Pattern:** No standardized pattern
- **Examples:**
  - `availablePermissions: ['command.read.test']`
  - `availablePermissions: ['foam.core.alarming.Alarm.rw.start']`
  - `availablePermissions: ['user.action.delete']`
- **Implementer:** Action.js
- **Note:** Defined within individual action models

### 6. UI Section Visibility
- **Pattern:** `<modelname.toLowerCase()>.section.<sectionName>`
- **Example:** `foam.core.cron.schedulable.section.history`
- **Implementer:** Unknown/undocumented
- **Note:** Sections are not permissioned by default. To enable permission include: `permissionRequired: true` in the section.

### 7. Table Column Visibility
- **Pattern:** `<model>.column.<property>`
- **Example:** `approvalrequest.column.approver`
- **Implementer:** UnstyledTableView.js:567-573
- **Configuration:** `columnPermissionRequired: true`
- **Note:** Distinct from general property access permissions; controls table/grid view visibility only

### 8. Role Permissions
Permissions of the form `@<GroupName>` grant all permissions owned by the `<GroupName>` group.
This is typically used to create "Role" Groups which don't have any direct users but are just used
to create collections of Permissions. These types of Groups are prefixed by "Role" by convention.
Ex.: `"OpsRole", "ReflowRole"`

## Permission Pattern Summary

| Pattern | Purpose |
|---------|---------|
| `service.<serviceName>` | Service access |
| `service.run.<serviceName>` | WebAgent execution |
| `<model>.read.<id>` | Read object |
| `<model>.update.<id>` | Update object |
| `<model>.remove.<id>` | Delete object |
| `<model>.create` | Create object |
| `<model>.ro.<property>` | Read property |
| `<model>.rw.<property>` | Write property |
| `<model>.column.<property>` | View table column |
| **No standard pattern** | Execute actions |
| `@<RoleName>` | Grant all Role permissions |

## User Interface

### Permission Management
- **PermissionMatrix** - Primary permission management interface [9](#1-8)
- **Security Audit** - run the "Security Audit" FLOW to get a report of all DAO security configurations. The Security Audit is also part of the FOAM test suite.
- **Security Principle:** Users cannot grant permissions they don't possess (implicitly or explicitly)

## Notes

The FOAM permission system implements a comprehensive authorization framework with wildcard support, hierarchical naming, and multiple specialized authorizers. [10](#1-9)  The system integrates with both traditional group-based permissions and the advanced CRUNCH capability system for fine-grained access control.

Wiki pages you might want to explore:
- [Advanced Features and Extensions (kgrgreer/foam3)](/wiki/kgrgreer/foam3#7)

### Citations

**File:** src/foam/core/auth/Permission.js (L7-24)
```javascript
 foam.CLASS({
   package: 'foam.core.auth',
   name: 'Permission',

   documentation: 'A permission represents access to system resources.',

   properties: [
     {
       class: 'String',
       name: 'id',
       tableWidth: 400
     },
     {
       class: 'String',
       name: 'description',
       documentation: 'Description of the Group.'
     }
   ],
```

**File:** src/foam/core/auth/pom.js (L16-16)
```javascript
    { name: "User",                                                   flags: "js|java" },
```

**File:** src/foam/core/auth/pom.js (L67-67)
```javascript
    { name: "Group",                                                  flags: "js|java" },
```

**File:** src/foam/core/auth/Relationships.js (L7-14)
```javascript
foam.RELATIONSHIP({
  cardinality: '*:*',
  sourceModel: 'foam.core.auth.Group',
  targetModel: 'foam.core.auth.Permission',
  forwardName: 'permissions',
  inverseName: 'groups',
  junctionDAOKey: 'groupPermissionJunctionDAO'
});
```

**File:** src/foam/core/crunch/Capability.js (L7-14)
```javascript
foam.CLASS({
  package: 'foam.core.crunch',
  name: 'Capability',

  implements: [
    // See CapabilityRefinement for additional implements
    'foam.core.auth.LifecycleAware'
  ],
```

**File:** src/foam/core/auth/AuthorizableAuthorizer.java (L14-44)
```java
public class AuthorizableAuthorizer implements Authorizer {

  protected String permissionPrefix_;

  public AuthorizableAuthorizer(String permissionPrefix) {
    permissionPrefix_ = permissionPrefix;
  }

  public void authorizeOnCreate(X x, FObject obj) throws AuthorizationException {
    if ( obj instanceof Authorizable ) {
      ((Authorizable) obj).authorizeOnCreate(x);
    }
  }

  public void authorizeOnRead(X x, FObject obj) throws AuthorizationException {
    if ( obj instanceof Authorizable ) {
      ((Authorizable) obj).authorizeOnRead(x);
    }
  }

  public void authorizeOnUpdate(X x, FObject oldObj, FObject obj) throws AuthorizationException {
    if ( obj instanceof Authorizable ) {
      ((Authorizable) obj).authorizeOnUpdate(x, oldObj);
    }
  }

  public void authorizeOnDelete(X x, FObject obj) throws AuthorizationException {
    if ( obj instanceof Authorizable ) {
      ((Authorizable) obj).authorizeOnDelete(x);
    }
  }
```

**File:** src/foam/lib/PermissionedPropertyPredicate.js (L22-28)
```javascript
        if ( prop.getReadPermissionRequired() ) {
          String      propName = prop.getName().toLowerCase();
          AuthService auth     = (AuthService) x.get("auth");

          return ( auth != null )
            ? (auth.check(x,  of + ".ro." + propName) || auth.check(x,  of + ".rw." + propName))
            : false;
```

**File:** src/foam/core/auth/PermissionTableView.js (L13-39)
```javascript
foam.CLASS({
  package: 'foam.core.auth',
  name: 'PermissionTableView',
  extends: 'foam.u2.Controller',

  implements: [ 'foam.mlang.Expressions' ],

  requires: [
    'foam.graphics.ScrollCView',
    'foam.core.auth.Group',
    'foam.core.auth.GroupPermissionJunction',
    'foam.core.auth.Permission'
  ],

  imports: [
    'auth',
    'groupDAO',
    'groupPermissionJunctionDAO',
    'permissionDAO',
    'user'
  ],

  constants: {
    COLS: 26,
    ROWS: 17,
    ROLE_PREFIX: 'Role'
  },
```

**File:** src/permissions.jrl (L1-10)
```text
p({"class":"foam.core.auth.Permission","id":"*","description":"Do anything global permission."})
p({"class":"foam.core.auth.Permission","id":"menu.auth","description":"Perform authentication related configuration"})
p({"class":"foam.core.auth.Permission","id":"service.*","description":"Global permission for reading of services"})
p({"class":"foam.core.auth.Permission","id":"service.read.*","description":"Global permission for reading of services from a DAO"})
p({"class":"foam.core.auth.Permission","id":"service.auth.checkUser","description":"Permission to grant access to check user permissions."})
p({"class":"foam.core.auth.Permission","id":"emailmessage.read.*","description":""})
p({"class":"foam.core.auth.Permission","id":"smsmessage.read.*","description":""})
p({"class":"foam.core.auth.Permission","id":"menu.read.admin","description":"Ability to use the 'admin' menu."})
p({"class":"foam.core.auth.Permission","id":"menu.read.admin.send-notification","description":"Ability to use Send Notification UI"})
p({"class":"foam.core.auth.Permission","id":"menu.read.admin.customise-theme","description":"Ability to use Theme Customisation UI"})
```

TODO:
difference between cSpecDAO and AuthenticatedCSpecDAO
