/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "box",
  licenses: [
    `
    Copyright 2026 The FOAM Authors. All Rights Reserved.
    http://www.apache.org/licenses/LICENSE-2.0
    `
  ],

  files: [
    { name: "Remote",                                             flags: "js" },
    { name: "Box",                                                flags: "js|java" },
    { name: "Envelope",                                           flags: "js|java" },
    { name: "ReplyBox2",                                          flags: "js|java" },
    { name: "RemoteException",                                    flags: "js|java" },
    { name: "Skeleton",                                           flags: "js|java" },
    { name: "SubBoxMessage",                                      flags: "js|java" },
    { name: "TimeoutBox",                                         flags: "js" },
    { name: "RetryBox",                                           flags: "js" },
    { name: "KeepAliveBox",                                       flags: "js|java" },
    { name: "SubBox",                                             flags: "js|java" },
    { name: "RPCReturnMessage",                                   flags: "js|java" },
    { name: "RPCErrorMessage",                                    flags: "js|java" },
    { name: "RPCReturnBox",                                       flags: "js|java" },
    { name: "RPCMessage",                                         flags: "js|java" },
    { name: "socket/SocketClientBox",                             flags: "js|java" },
    { name: "socket/SocketClientReplyBox",                        flags: "js|java" },
    { name: "socket/SocketConnectionBoxManager",                  flags: "js|java" },
    { name: "socket/SocketServer",                                flags: "js|java" },
    { name: "socket/SslContextFactory",                           flags: "js|java" },
    { name: "socket/UnsafeSslContextFactory",                     flags: "js|java" },
    { name: "InvalidMessageException",                            flags: "js" },
    { name: "SkeletonBox",                                        flags: "js" },
    { name: "NullBox",                                            flags: "js|java" },
    { name: "SendFailedError",                                    flags: "js" },
    { name: "RawWebSocketBox",                                    flags: "js|java" },
    { name: "ReturnBox",                                          flags: "js|java" },
    { name: "WebSocketBox",                                       flags: "js" },
    { name: "HTTPReplyBox",                                       flags: "js|java" },
    { name: "HTTPAuthorizationType",                              flags: "js|java" },
    { name: "HTTPBox",                                            flags: "js|java" },
    { name: "SessionClientBox",                                   flags: "web|java" },
    { name: "SessionReplyBox",                                    flags: "js"},
    { name: "AuthServiceClientBox",                               flags: "js|java" },
    { name: "AbstractSkeleton",                                   flags: "js|java" },
    { name: "socket/BoxHolder",                                   flags: "js|java" },
    { name: "socket/SocketConnectionBox",                         flags: "js|java" },
    { name: "socket/SocketConnectionReplyBox",                    flags: "js|java" },
  ],

  javaFiles: [
    { name: "SessionServerBox" },
    { name: "socket/SocketRouter" },
    { name: "socket/SocketServerProcessor" },
  ]
});
