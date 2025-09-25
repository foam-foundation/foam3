# FOAM Application Security

FOAM application security centers around **services** and **permissions** to those services.

Services are known as CORE Services and their access configuration is modelled under the name **CSpec** (CORE Service Specification).  The CSpec controls how a service is exposed to the rest of the system.

- See `doc/guides/Services.md` for documenation regarding Services themselves.
- See `doc/guides/Permissions.md` for documentation regarding Permissions themselves.- see `src/foam/core/auth/README.md` for documentation on the Authentication system itself - how authentication is implemented and how permission checking occurs.  Overlaps with this documentation.

CSpecs are deployed in `services.jrl` journals and can also be created and manipulated at runtime.

- See `foam/src/services.jrl` for many examples.

Services, by default, are only accessible within the server application. They can be exposed to clients with CSpec property `serve`.

Services which are served, are authenticated. Authentication is enabled by default via CSpec property `authenticate`.

***A client's permissions are those of the *user* that is associated with the *session* of the client connection.***

Autenticated services require the client (connecting user) to have permission

- `service.read.<cspec-name><cspec.name>`
- _`service.<cspec-name>` (legacy)_

Unauthenticated services are open to all clients for reading.

Once a client connects to a service, security managing data manipulation is controlled at the model level (discussed below in Model Security).

The `service` that the CSpec describes is specified by one of the following properties, which resolve to a modelled class.

- service
    - { class: "foam...Foo", property: value, ...}
- serviceClass
    - "foam...FooServiceServer"
- serviceScript
    - " return new EasyDAO().... "

When the service is served, then the `client` property must be configured.

- client
    - { "of": "foam...Foo", cache: false, ... } // DAO service
    - { "class": "foam...ClientFooService", "delegate": ... }

Additionally if the service is modelled as an `INTERFACE`, then `boxClass` property must also be provided. See `/#flowdoc/Boxes.flow` for a discussion of FOAM's Box messaging protocol. 

- boxClass
    - "foam...FooServiceSkeleton"

When the service is a DAO, then typically, a `serviceScript` is used to describe the DAO stack with `EasyDAO` (discussed below).

## Model Security

Model security applies to both client and server operations, and is independent of the service's accessibility.

Model security is implemented via permissions. The permissins are imposed at two levels: 1) the model itself controlling instance visibility and manipulation, and 2) model properties controlling visibility and manipulation of individual properties.

### Model Level

Model level authentication is imposed via `AuthorizationDAO`, verifying the user has appropriate permissions for each CRUD operation.

Two interfaces control how the AuthorizationDAO is configured for each service:

1. Authorizable
    - implemented by the model itself. AuthorizationDAO is configured with the `AuthorizableAuthorizer` which delegates to the model for permission checking. 
    - A model would implement `Authorizable` when requiring behaviour different from the `StandardAuthorizer`.
        - see `foam.core.auth.User` as an example.
1. Authorizer - implemented as a stand alone class. FOAM provides implementations for common scenarios that can be applied to most models.
    1. StandardAuthorizer (default)
        - verifies user has permission for each CRUD operation.
        - permission format (all lowercase):
            - modelname.read.id
            - modelname.create
            - modelname.update.id
            - modelname.remove.id
    1. Global Authorizers:
        - Global authorizers extend StandardAuthorizer and make particular CRUD operations unauthenticated.
            - GlobalReadAuthorizer: permission not required to read all DAO entries.
            - GlobalFindAuthorizer: permission not required to find all DAO entries.
            - GlobalPutAuthorizer: permission not required to create or update DAO entries.
            - GlobalCreateAuthorizer: permission not require to create new DAO entries.
            - GlobalFindOrPutAuthorizer: permission not required to find or put DAO entries.

#### EasyDAO

Typically the `AuthorizationDAO` is configured by `EasyDAO`.

EasyDAO is a support model designed to hide the complexities of, correctly and securely, configuring DAO decoration for a service (DAO stack).

EasyDAO properties relevant to Model level authentication:

- authorize: enabled by default, EasyDAO configures AuthorizationDAO with the StandardAuthorizer
- authorizer: when specified EasyDAO configures AuthorizationDAO with this authorizer.

### Model Property Level (incomplete)

Model property authentication allows for fine grained per-property permissioning.  It is imposed by `PermissionedPropertyDAO`.

Model property permissioning affects both client and server.

Typically, PermissionedPropertyDAO is configured by EasyDAO, with property `permissioned`.

EasyDAO properties relevant to Model level authentication:

- permissioned: When not explicitly set to true or false, EasyDAO will inspect the model for properties configured with any of the following flags and if found decorate the service with PermissionedPropertyDAO.
    - writePermissionRequired
        - when true, permission modelName.rw.propertyName is required
        - on the server
            - `put`s replace the incomming value with the previous value, nullify any change.
    - readPermissionedRequired
        - when true, permission modelName.ro.propertyName is required
        - on the server
            - `find`s replace the current property value with it's default.
            - `put`s replace the incomming value with the previous value, nullify any change.
        - on the client
            - without the permission, the property is hidden
    - updatePermissionRequired
        - unused? 
            - used but not clear how different from writePermissionRequired
            - see `foam.u2.Element2.js:1767`, `foam/core/auth/PermissionedPropertyDAO.js:118 & 222`
- permissionPrefix: by default the permissionPrefix is the model name in lowercase.

## Q & A (incomplete)

1. What does setting `authenticate` on the cspec do? Is it safe to set it false?
    - `authenticate` comes into play when a CSpec is served (`serve:true`). A served service is exposed to clients and by default is authenticated. Authentication requires the user to have permission `service.<CSpec.name>`.  An unauthenticated service (`authenticate:false`), will be visible to all clients.
    - If the CSpec is for a DAO, then security shifts to the model level (described elsewhere).  It is unwise, without careful review, to have both CSpec `authenticate:false` and EasyDAO  `authorize:false`.
    - If the CSpec is for a non-DAO service, then `authenticate:false`, makes the service accessible to all clients.

1. Do I need to set both service.somethingDAO and something.read.* permissions?
    - If your model is using the default EasyDAO authorization, then both permissions `service.<modelDAO>` and `model.read.*` are required.  If EasyDAO authorizer is configured with the GlobalReadAuthoriizer, then all clients can read all objects, but permissions to create, update, delete (ex. `model.update.*`) are required.

1. What do I need to make my object Authorizable? Does it just work by default?
    - EasyDAO, by default, will decorate your model's DAO with an AuthorizationDAO which will enforce permissions for each CRUD operation (read, create, update, and delete).  If you require permission check behaviour different from the StandardAuthorizer, then have your model implement `foam.core.auth.Authorizable` and implement each of the `authorizeOn...` methods.

1. How do the something.read.* permissions come into play if my object is authorizable
    - if a model implements `foam.core.auth.Authorizable` or, for a DAO, `EasyDAO.authorize` is enabled (which it is by default), then any `read` request by a client must have permission `<modelname>.read.*` or one or more `<modelname>.read.id` for each `id` of interest.

1. What is the "global read permission" in the standardauthorizer class for?
    - The global read permission `model.read.*` is a wildcard permission which allows a user to see all ids (all instances) of the model in question.  By default a user is restricted to only see instances they have been given explicit access to via a permission of the form `model.read.id`.

1. How is the context configured in the authorizable callback for an Authorizable service? Does it have permissions scoped to the user making the request or system permissions or what? If I want to check something in a different dao that the user doesn't have permission for which context do i use? Can I sudo?
    - Every client request is performed with the context scoped to the user. If server logic requires access the user does not have then generally it can use the context of this.getX(). The service instance context is set at creation time and is that of the system.
    - `Auth.sudo` is used when logic requires reduced scoped or scope of another user (other than system).  For example, Approvals, approved by an operator but when `put`, the context of the user that the Approval affects is used so that rules of the post approval flow execute in the user's scope.

1. Also feature request: some sort of debugging mode or debugging flag i can put on my requests so I can check why i'm not seeing object I expected in a DAO. Debugging failed permission check is a bit of a black box.
    - uncomment `src/foam/java/Skeleton.js:157`
    - TODO: implement support for this.

## Other Security Topics (TODO)

- Security Audit  - readOnly, authNotes, nullify (other EasyDAO settings)
- Multi-Tenancy - SPID
- IP filtering - CIDR
- API - DIG and SUGAR Authentication - #flowdoc/api-doc-authentication
- Public/Private Key Pairs
- SSL Certificates - Sockets, HTTPS
- Long term session tokens (API Bearer tokens)
- CSpec creation and manipulation at runtime.
- Merge this and foam/core/auth/README.md
