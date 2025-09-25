# FOAM API Testing

FOAM provides it's own support for API testing against itself.  Similar to third party tools such as Postman.

Using FOAM's DIG (Data Interchange Gateway) as a client one can act as an external user with scoped privileges and also retain full application context access to test and manipulate the system between external calls.

Equally important, a developer can continue working with FOAM model's directly. No need to craft JSON building and parsing, and inspection logic, to interact with a FOAM application.

Additionally, since the *tests* are created with FOAM, they can be included in FOAMs regular suite of test cases.

- see `foam/core/dig/README.md` for documentation on DIG itself.

Typical API testing involves user and session setup, then a cycle of test and inspection. Often also requiring administrative access to test or manipulate the application between test cases.

A DIG test is modelled and extends `foam.core.test.AbstractDIGTest`.

From within `runTest` the supplied context has direct access to the application, and allows regular application DAO operations such as creating Users, Sessions.

Creating a user, that would be associated with a session, in turn, used by the DIG client

    User user = new User();
      user.setSpid("test");
      user.setFirstName("test");
      user.setLastName("test");
      user.setEmail(...);
      user.setUserName(...);
      user.setGroup(groupId);
      user.setEmailVerified(true);
      user.setLifecycleState(LifecycleState.ACTIVE);
      user = (User) ((DAO)x.get("userDAO")).put(user);

Creating a session, that a DIG client would use. 

    Session session = new Session();
      session.setUserId(user.getId());
      session.setTtl(3153600000000L);
      session = (Session) ((DAO) x.get("sessionDAO")).put(session);

NOTE: DIG also supports creating a session via SUGAR (externally) if required.

- see `DIG.createSession`

DIG, on receipt of a non-200 HTML response code will throw a `FOAMException`.

Additionally, permissions, capabilities, ... anything needed to prepare the test environment can be setup with the supplied test context.

Acquiring a DIG client

    DIG fooClient = new DIG.Builder(x)
      .setDaoKey("fooDAO')
      .setSessionId(session.getId())
      .setConnectionTimeout(getConnectionTimeout())
      .setRequestTimeout(getRequestTimeout())
      .build();

The client is used to interact with the application via the external service access (see `doc/guides/Security.md` regarding CSpec setup).
Access via the client is scoped to the user of the session, with regard to authentication.

## Examples

Example DAO operation

    Foo foo = new Foo();
    foo.setSomething(...);
    foo = (Foo) fooClient.put(foo);
    test ( foo != null, "Foo created");

Example non-DAO service operation

    DIG interac = new DIG(x);
      interac.setServiceName("interacRTP");
      interac.setSessionId(session.getId());
      interac.setRequestTimeout(getRequestTimeout());
      response = interac.submit(x, DOP.FIND, "token="+foo.getId());
      if ( response.toString().contains("<title>Google</title>") ) {
        test ( true, "DIG interacRTP redirect to expected test page.");
      } else {
        HttpResponse resp = (HttpResponse) interac.getLastHttpResponse();
        if ( resp.uri().toString().contains("ServiceErrorPage") ) {
          test ( false, "DIG interacRTP failed to redirect");
        } else {
          test ( false, "DIG interacRTP redirect to unexpected page: "+response);
        }
      }

Testing, manipulating the server between test cases

Creating GroupPermissionJunction

    // Allow subsequent ucj creation
    GroupPermissionJunction gpj = new GroupPermissionJunction();
    gpj = new GroupPermissionJunction();
    gpj.setSourceId(user.getGroup());
    gpj.setTargetId("service.crunchService.unsafeSetStatus");
    ((DAO) x.get("groupPermissionJunctionDAO")).put(gpj);

Testing for **UCJ**

    // test user has someCapability
    ucj = findUCJ(x, user.getId(), "someCapability");
    test ( ucj != null, "User UCJ someCapabilty found");

Example issuing a client call, then testing via context and DUG

      req = (FooRequest) client.find(req.getId());
      test ( req.getStatus() == FooStatus.RECEIVED, "DIG FooRequest status RECEIVED "+req.getStatus());
      Transaction txn = (Transaction) ((DAO) x.get("transactionDAO")).find(req.getTransaction());
      test ( txn != null, "DAO Associated transaction found");
      Transaction state = txn.getStateTxn(x);
      test ( state.getStatus() == TransactionStatus.SENT, "DAO Transaction SENT "+state.getStatus());
      dugReq = (FooRequest) getDUGContent(x);
      test ( dugReq != null && dugReq.getStatus() == FooStatus.RECEIVED, "DUG FooRequest status RECEIVED "+(dugReq == null ? null : dugReq.getStatus().toString()));


## Other features (TODO)

- DUG - DUGLoopback setup, getDUGContent
- UCJ - findUCJ
- Session - createSession via SUGAR
