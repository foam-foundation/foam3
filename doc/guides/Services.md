## How to Create Services

### Server
1. Create foam.Interface for Service

Eg: https://github.com/foam-framework/foam3/blob/master/src/foam/core/auth/AuthService.js

If your method returns a value to the client, make sure to include
"async: true" so that the client gets the return value.

2. In your foam.INTERFACE, include the property "skeleton: true", which will cause a skeleton to be generated

A skeleton is a server component which receives network messages and then converts them into calls
to the server implementation. If the method has return values or throws exceptions, it is also
the skeleton's responsibility to then marshal these return values or exceptions back in the network response.

3. In your services.jrl file
  - Name your service
  - Specify the skeleton
  - Specify the implementation
  - If serve is set to true, the skeleton will be generated

 Eg:

 `p({"class":"foam.core.boot.CSpec", "name":"auth", "lazy":true, "serve":true, "authenticate": false, "boxClass":"foam.core.auth.AuthServiceSkeleton", "serviceClass":"foam.core.auth.UserAndGroupAuthService", "client":"{\"class\":\"foam.core.auth.ClientAuthService\"}"})`

### CLIENT SIDE
4. Create stub for Service on the client side
Eg: https://github.com/foam-framework/foam3/blob/master/src/foam/core/auth/ClientAuthService.js,
or id you don't require any special client behaviour, just add the "client: true" property to your foam.INTERFACE.

A stub does the reverse job of the skeleton. It implements the provided interface, but when called, it marshals the method name and parameters into a network call which is then sent to the server to be received by the skeleton, and then subsequently, by the actual server implementation. The stub then parses the result created by the skeleton and converts them into method return values.

Client Code -> Service Client -> Stub -> Network -> Skeleton -> Service Server

But from the client's point of view, the stub/network/skeleton is transparent and it looks like they're just magically calling the server service directly:

Client Code -> Service Server

So, normally there is no work that needs to be done to implement the client-side service, as the stub does this by delegating across the network to the server implementation. However, you can decorate the default client service if you want to add some client-side functionality like caching.

5. In your code, import the service
Eg:
```
imports: [
  'stack', 'userDAO', 'user', 'auth'
],
```

Now, you can call the service in your code:
```
this.auth.login("marc4@marc.com", "marc123").then(function(response) {
  console.log(response);
}
```

## Service Example

- **Example**: [foam3/src/foam/demos/examples/services.fbe](../../src/foam/demos/examples/services.fbe)
