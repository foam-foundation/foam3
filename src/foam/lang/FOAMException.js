/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'FOAMException',
  implements: ['foam.lang.Exception'],
  javaExtends: 'RuntimeException',

  javaGenerateConvenienceConstructor: false,
  javaGenerateDefaultConstructor: false,

  imports: [
    'translationService?'
  ],

  javaImports: [
    'foam.lang.PropertyInfo',
    'foam.lang.XLocator',
    'foam.core.notification.email.EmailTemplateEngine',
    'foam.util.SafetyUtil',
    'java.util.HashMap',
    'java.util.List',
    'java.util.Map',
    'static foam.i18n.TranslationService.t'
  ],

  javaCode: `
    public FOAMException() {
      getHostname();
    }

    public FOAMException(String message) {
      super(message);
      setMessage(message);
      getHostname();
    }

    public FOAMException(String message, String errorCode) {
      super(message);
      setMessage(message);
      setErrorCode(errorCode);
      getHostname();
    }

    public FOAMException(Throwable cause) {
      super(cause);
      setMessage(cause.getMessage());
      getHostname();
    }

    public FOAMException(String message, Throwable cause) {
      super(message, cause);
      setMessage(message);
      getHostname();
    }

    public FOAMException(String message, String errorCode, Throwable cause) {
      super(message, cause);
      setMessage(message);
      setErrorCode(errorCode);
      getHostname();
    }

    public FOAMException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
      super(message, cause, enableSuppression, writableStackTrace);
    }

    protected static final java.util.regex.Pattern MESSAGE_PATTERN = java.util.regex.Pattern.compile("\\\\{\\\\{.*?\\\\}\\\\}");
  `,

  properties: [
    {
      name: 'id',
      class: 'String',
      factory: function() { return this.cls_.id; },
      javaFactory: 'return this.getClass().getName();',
      externalTransient: true,
      storageTransient: true,
      visibility: 'RO'
    },
    {
      name: 'exceptionMessage',
      class: 'String',
      value: '{{message}}',
      externalTransient: true,
      visibility: 'RO'
    },
    {
      name: 'message',
      class: 'String',
      storageTransient: true,
      visibility: 'RO'
    },
    {
      documentation: 'Override title of notification messages',
      name: 'title',
      class: 'String',
      visibility: 'RO'
    },
    {
      name: 'errorCode',
      aliases: ['code'],
      class: 'String',
      visibility: 'RO'
    },
    {
      name: 'hostname',
      class: 'String',
      javaFactory: 'return System.getProperty("hostname", "localhost");',
      visibilty: 'RO'
    },
    {
      name: 'isClientException',
      class: 'Boolean',
      value: false,
      hidden: true,
      externalTransient: true
    },
    {
      class: 'Boolean',
      name: 'retryable',
      documentation: "Indicates whether the request that generated this error might succeed if retried.",
      value: true
    }
  ],

  methods: [
    {
      documentation: 'Translate the exception message before template parameter replacement.',
      name: 'getTranslation',
      type: 'String',
      code: function() {
        if ( ! this.translationService ) return this.message;
        var msg = this.translationService.getTranslation(foam.locale, this.cls_.id+'.'+this.exceptionMessage, this.exceptionMessage);
        let m = this.getTemplateValues();
        for ( let [key, value] of m.entries() ) {
          msg = msg.replaceAll(key, value);
        }
        return msg;
      },
      javaCode: `
      return renderMessage(t(XLocator.get(), getClass().getName()+"."+getExceptionMessage(), getExceptionMessage()));
     `
    },
    {
      documentation: 'Perform template replacement on msg. Provides server side exceptionMessage template rendering, without translation.',
      name: 'renderMessage',
      args: 'String msg',
      type: 'String',
      javaCode: `
      if ( SafetyUtil.isEmpty(msg) ) {
        return msg;
      }
      try {
        EmailTemplateEngine template = (EmailTemplateEngine) foam.lang.XLocator.get().get("templateEngine");
        return template.renderTemplate(foam.lang.XLocator.get(), msg, getTemplateValues()).toString().trim();
      } catch (NullPointerException e) {
        // noop - Expected when not yet logged in, as XLocator is not setup.
      }
      // fallback
      java.util.regex.Matcher matcher = MESSAGE_PATTERN.matcher(msg);
      return matcher.replaceAll(message_ == null ? "" : message_);
      `
    },
    {
      documentation: 'Build map of template parameter replacements',
      name: 'getTemplateValues',
      type: 'Map',
      code: function() {
        var m = new Map();
        var ps = this.cls_.getAxiomsByClass(foam.lang.Property);
        for ( var i = 0, property; property = ps[i]; i++ ) {
          if ( ! property.externalTransient ) {
            m.set('{{'+property.name+'}}', this[property.name] || '');
          }
        }
        return m;
      },
      javaCode: `
      Map map = new HashMap();
      List<PropertyInfo> props = getClassInfo().getAxiomsByClass(PropertyInfo.class);
      for ( PropertyInfo prop : props ) {
        Object value = null;
        if ( "message".equals(prop.getName()) ) {
          value = message_;
          if ( value == null ) {
            value = "";
          }
        } else if ( prop.isSet(this) ) {
          value = prop.get(this);
        }
        if ( value != null ) {
          map.put(prop.getName(), String.valueOf(value));
        }
      }
      return map;
      `
    },
    {
      name: 'toString',
      type: 'String',
      code: function() {
        var s = this.id+',';
        s += '['+this.hostname+'],';
        if ( this.errorCode ) {
          s += '('+this.errorCode+'),';
        }
        s += this.message;
        return s;
      },
      javaCode: `
      StringBuilder sb = new StringBuilder();
      sb.append(getId());
      sb.append(",[");
      sb.append(getHostname());
      sb.append("],");
      if ( ! foam.util.SafetyUtil.isEmpty(getErrorCode()) ) {
        sb.append('(');
        sb.append(getErrorCode());
        sb.append("),");
      }
      sb.append(renderMessage(getExceptionMessage()));
      return sb.toString();
      `
    },
    {
      name: 'getClientRethrowException',
      documentation:
      `If an exception is intended to go to the client, this
      returns an exception object; it returns null otherwise.

      Note that the exception returned by this property is the
      one that should be re-thrown. This is particularly useful
      for CompoundException where the CompoundException itself
      is not intended to be re-thrown but any of its child
      exceptions might be.`,
      type: 'RuntimeException',
      visibility: 'public',
      javaCode: 'return getIsClientException() ? this : null;'
    }
  ]
});
