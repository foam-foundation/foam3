/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.lang',
  name: 'ValidationException',
  extends: 'foam.lang.ClientRuntimeException',
  javaGenerateConvenienceConstructor: false,

  properties: [
    {
      class: 'Object',
      of: 'foam.lang.PropertyInfo',
      name: 'propertyInfo'
    },
    {
      class: 'String',
      name: 'propName'
    }
  ],

  javaCode: `
    public ValidationException(String message) {
      super(message);
    }

    public ValidationException(String message, Throwable cause) {
      super(message, cause);
    }

    public ValidationException(Throwable cause) {
      super(cause);
    }
  `
});

foam.CLASS({
  package: 'foam.lang',
  name: 'PropertyRequiredException',
  extends: 'foam.lang.ValidationException',
  javaGenerateConvenienceConstructor: false,

  properties: [
    {
      name: 'exceptionMessage',
      value: '{{propLabel}} required'
    },
    {
      class: 'String',
      name: 'propLabel',
      factory: function() {
        return this.propertyInfo.label;
      },
      javaFactory: 'return foam.util.StringUtil.labelize(getPropName());'
    }
  ],

  javaCode: `
    public PropertyRequiredException(String message) {
      super(message);
    }

    public PropertyRequiredException(String message, Throwable cause) {
      super(message, cause);
    }

    public PropertyRequiredException(Throwable cause) {
      super(cause);
    }
  `
});