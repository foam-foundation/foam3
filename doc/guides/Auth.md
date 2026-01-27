See:
  [auth/README.md](../../src/foam/core/auth/README.md)
  [Permissions.md](Permissions.md)

# FOAM Authorization System

## Core Model Relationships

The FOAM authorization system is built around four primary models: `User`, `Group`, `Permission`, and `Capability`. These models are connected through junction tables that enable many-to-many relationships while storing additional metadata.

### Junction Tables
- `GroupPermissionJunction`: Manages many-to-many relationships between groups and permissions
- `UserCapabilityJunction`: Manages many-to-many relationships between users and capabilities, storing additional data like status and expiry information

### Permission Granting
Capabilities can grant permissions through their `permissionsGranted` property. The authorization system uses these relationships to determine user permissions through both group membership and granted capabilities.

## Pseudo-Permission Inheritance

The `@GroupName` pseudo-permission creates a permission inheritance relationship between groups. When a group is assigned a permission with the `@` prefix, it gains all permissions from the referenced target group.

### Implementation Details
1. **Pseudo-Permission Detection**: Permissions starting with `@` are treated as special group references
2. **Target Group Resolution**: The system extracts the group name after `@` and looks up that group's permissions
3. **Permission Inheritance**: All permissions from the target group are implicitly granted to the source group

### Key Characteristics
- The pseudo-permission feature provides a way to create permission templates or role-based access patterns
- It's separate from the parent-child group hierarchy, allowing cross-branch permission inheritance
- The `@` prefix is reserved for this special functionality and shouldn't be used for regular permission names
- This mechanism is particularly useful for creating common permission sets that can be reused across multiple groups

## ServiceProvider (SPID) System

See [SPID.md](SPID.md) for comprehensive documentation on the SPID system.

`ServiceProvider` is a subclass of `Capability` that extends the core capability functionality. This provides multi-tenancy by isolating data and permissions per service provider.

### Inherent Permissions
Each ServiceProvider automatically grants two specific permissions based on its ID:
- `serviceprovider.read.<spid>` - Permission to read objects associated with this SPID
- `serviceproviderdao.read.<spid>` - Permission to read ServiceProvider objects in the DAO

### User Home SPID
Each User has a `spid` property that references their home ServiceProvider. When a user's SPID is set or changed, the system automatically creates or updates UserCapabilityJunctions to grant the ServiceProvider capability.

### Authorization Flow
The authorization system checks SPID permissions through:
1. Direct permission checks for `serviceprovider.read.<spid>` and `serviceproviderdao.read.<spid>`
2. Capability-based permission checking via UserCapabilityJunctions
3. SPID context checking when no user is present in the context

### Key Features
- Users can only access data from their home SPID unless explicitly granted additional permissions
- The ServiceProvider capability acts as both a capability and a permission granter, creating a flexible authorization model
- SPID permissions are automatically created when ServiceProviders are created via the createPermissions script

## Groups vs Capabilities: Key Differences

### Cardinality Differences
The fundamental difference between Groups and Capabilities lies in their relationship with Users:
- **Groups**: Each User belongs to exactly one Group
- **Capabilities**: Each User can have any number of Capabilities through UserCapabilityJunctions

### Prerequisite System
Capabilities have a unique prerequisite system that Groups lack:
- Capabilities can depend on other capabilities through prerequisite relationships
- A capability is only enabled (GRANTED status) when all its prerequisites are met
- The system checks prerequisite status using `getPrereqsChainedStatus` which evaluates the entire prerequisite chain

### SPID-Level Control Example
The prerequisite system enables powerful SPID-level feature control:
- A prerequisite capability can be granted to a User's SPID (ServiceProvider capability)
- When that prerequisite is removed from the SPID, all dependent capabilities for all users of that SPID are automatically disabled
- The `invalidateDependents` method ensures all dependent UserCapabilityJunctions are updated when a SPID capability is removed

### Practical Use Cases
This design pattern allows for:
- **Feature Flags**: Grant a prerequisite capability to enable/disable features for entire SPIDs
- **Compliance Control**: Remove a prerequisite to immediately disable regulated features across a tenant
- **Progressive Enablement**: Users must acquire prerequisite capabilities before accessing advanced features
- **Bulk Management**: Control access for hundreds of users by managing a single SPID prerequisite

Additionally, sub-classes of Capability can be greated which offer specialized functionality. The ServiceProvide class is a sub-class Capability. The `inherentPermissions` Property is meant to be used by Capability sub-classes.

## Role Convention

Roles are Groups that follow a specific naming convention and usage pattern in the FOAM authorization system. This is purely a convention, not enforced by the software architecture.

### Role Definition
Roles are Groups with IDs that start with the "Role" prefix. The system identifies roles using a predicate that checks for this prefix.

### Role Characteristics
By convention, Roles:
- Have no users directly assigned to them
- Are used to bundle permissions together
- Act as permission templates that can be inherited by other Groups

### Role Inheritance Mechanism
Groups can inherit all permissions from a Role by assigning the pseudo-permission `@RoleName`. This creates a clean separation between:
- **Roles**: Permission bundles (no direct users)
- **Groups**: User containers that inherit from roles

### Implementation Details
The permission table view filters roles using the ROLE_PREFIX constant. When displaying role permissions, it shows only groups with the "Role" prefix.

### Benefits
This convention reduces maintenance overhead by:
- Centralizing permission definitions in roles
- Allowing multiple groups to share the same permission set
- Simplifying permission management through inheritance

## Additional Notes

- All relationships are defined using FOAM's `RELATIONSHIP` DSL which handles the underlying DAO configurations
- Roles can still participate in the normal Group hierarchy (parent-child relationships)
- The `@` prefix for pseudo-permissions enables the role inheritance pattern
- This pattern is commonly used in the Flow access control system where roles grant specific flow permissions [17](#4-16)

## TODO

- Clarify how the Capability.autoGrantPrereqs feature works.