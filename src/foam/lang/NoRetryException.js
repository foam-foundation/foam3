/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'NoRetryException',
  extends: 'foam.lang.ClientRuntimeException',

  javaCode: `
    public NoRetryException(String message) {
      super(message);
    }

    public NoRetryException(Throwable cause) {
      super(cause);
    }

    public NoRetryException(String message, Throwable cause) {
      super(message, cause);
    }
  `,

  properties: [
    {
      class: 'Proxy',
      of: 'foam.lang.Exception',
      name: 'delegate'
    }
  ]
});
