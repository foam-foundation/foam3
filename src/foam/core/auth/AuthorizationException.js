/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'AuthorizationException',
  extends: 'foam.lang.FOAMException',
  javaGenerateDefaultConstructor: false,
  javaGenerateConvenienceConstructor: false,

  documentation: `
    Thrown when a user tries to access a resource that they don't have
    permission to access.
  `,

  javaCode: `
    public AuthorizationException() {
      super("Permission denied.");
    }

    public AuthorizationException(String message) {
      super(message);
    }

    public AuthorizationException(String message, Throwable cause) {
      super(message, cause);
    }

    public AuthorizationException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
      super(message, cause, enableSuppression, writableStackTrace);
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'errorCode',
      value: '1009'
    },
    {
      name: "retryable",
      value: false
    }
  ]
});
