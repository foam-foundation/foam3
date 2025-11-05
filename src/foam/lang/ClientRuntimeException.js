/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  name: 'ClientRuntimeException',
  package: 'foam.lang',
  extends: 'foam.lang.FOAMException',

  javaGenerateConvenienceConstructor: false,
  javaGenerateDefaultConstructor: false,

  properties: [
    {
      name: 'isClientException',
      value: true
    },
    {
      name: 'retryable',
      value: false
    }
  ],

  javaCode: `
    public ClientRuntimeException() {
      super();
    }

    public ClientRuntimeException(String message) {
      super(message);
    }

    public ClientRuntimeException(Throwable cause) {
      super(cause);
    }

    public ClientRuntimeException(String message, Throwable cause ) {
      super(message, cause);
    }
  `
});
