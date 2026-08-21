/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.comics.v2.userfeedback',
  name: 'UserFeedback',
  documentation: `
    A model track of feedback messages as an object travels 
    through multiple decorators on the back-end and 
    inevitably making its way back to the client who views the feedback
  `,

  javaImports: [
    'java.util.HashMap',
    'java.util.Map'
  ],

  javaCode: `
  public UserFeedback(UserFeedbackStatus status, String message) {
    setStatus(status);
    setMessage(message);
  }

  public UserFeedback(UserFeedbackStatus status, String message, String subMessage) {
    setStatus(status);
    setMessage(message);
    setSubMessage(subMessage);
  }

  public UserFeedback(UserFeedbackStatus status, String message, String subMessage, String... templateKV) {
    setStatus(status);
    setMessage(message);
    setSubMessage(subMessage);
    if ( templateKV != null && templateKV.length > 0 && templateKV.length % 2 == 0 ) {
      Map templateMap = new HashMap();
      for ( int i = 0; i < templateKV.length; i += 2 ) {
        templateMap.put(templateKV[i], templateKV[i+1]);
      }
      setMessageTemplateMap(templateMap);
    }
  }
  `,

  properties: [
    {
      class: 'Enum',
      name: 'status',
      of: 'foam.comics.v2.userfeedback.UserFeedbackStatus'
    },
    {
      class: 'String',
      name: 'message'
    },
    {
      class: 'String',
      name: 'subMessage'
    },
    {
      // Map of translation message template values for client side translation
      class: 'Map',
      name: 'messageTemplateMap'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.comics.v2.userfeedback.UserFeedback',
      name: 'next',
      javaToCSV: `// intentionally left empty to prevent circular reference`,
      javaToCSVLabel: ``
    }
  ],
});
