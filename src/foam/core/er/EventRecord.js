/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.er',
  name: 'EventRecord',

  documentation: `A modelled log message for reoccuring system events`,

  implements: [
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.auth.ServiceProviderAware',
    'foam.core.medusa.Clusterable'
  ],

  javaImports: [
    'foam.lang.X',
    'foam.log.LogLevel',
    'foam.util.SafetyUtil'
  ],

  tableColumns: [
    'source',
    'event',
    'partner',
    'code',
    'severity',
    'message',
    'hostname',
    'created'
  ],

  searchColumns: [
    'source',
    'event',
    'partner',
    'code',
    'severity'
  ],

  javaCode: `
  public EventRecord(X x, Object source, String event) {
    setX(x);
    setEvent(event);
    setSource(source);
  }

  public EventRecord(X x, Object source, String event, String message) {
    setX(x);
    setSource(source);
    setEvent(event);
    setMessage(message);
  }

  public EventRecord(X x, Object source, String event, String message, LogLevel severity, Throwable t) {
    setX(x);
    setSource(source);
    setEvent(event);
    setMessage(message);
    setSeverity(severity);
    setException(t);
  }

  public EventRecord(X x, Object source, String event, String partner, String code, String message, LogLevel severity, Throwable t) {
    setX(x);
    setSource(source);
    setEvent(event);
    setPartner(partner);
    setCode(code);
    setMessage(message);
    setSeverity(severity);
    setException(t);
  }
  `,

  properties: [
    {
      name: 'id',
      class: 'String',
      visibility: 'RO'
    },
    {
      // TODO: class and method?
      name: 'source',
      class: 'Object',
      updateVisibility: 'RO',
      javaSetter: `
      if ( val == null ) {
        source_ = val;
        sourceIsSet_ = false;
        return;
      }
      if ( val instanceof String ) {
        source_ = val;
      } else {
        source_ = val.getClass().getSimpleName();
      }
      sourceIsSet_ = true;
      `
    },
    {
      name: 'event',
      class: 'String',
      visibility: 'RO'
    },
    {
      name: 'partner',
      class: 'String',
      updateVisibility: 'RO'
    },
    {
      // optional
      name: 'code',
      class: 'String',
      updateVisibility: 'RO'
    },
    {
      name: 'message',
      class: 'String',
      updateVisibility: 'RO',
      view: {
        class: 'foam.u2.tag.TextArea',
        rows: 5,
        cols: 80
      },
      required: true
    },
    {
      name: 'severity',
      class: 'Enum',
      of: 'foam.log.LogLevel',
      value: 'INFO',
      javaFormatJSON: 'formatter.output(get_(obj).getName());',
      updateVisibility: 'RO',
      tableCellFormatter: function(severity, obj, axiom) {
         this
          .start()
            .setAttribute('title', severity.label)
            .add(severity.label)
            .style({ color: severity.color })
          .end();
      },
      tableWidth: 90
    },
    {
      class: 'String',
      name: 'hostname',
      visibility: 'RO',
      javaFactory: `
      return System.getProperty("hostname", "localhost");
      `
    },
    {
      // these next two could be a subclass RequestResponseER
      // REVIEW: non-storageTransient? Could leak data
      name: 'requestMessage',
      class: 'String',
      updateVisibility: 'RO',
      view: {
        class: 'foam.u2.tag.TextArea',
        rows: 5,
        cols: 80
      },
      storageTransient: true
    },
    {
      name: 'responseMessage',
      class: 'String',
      updateVisibility: 'RO',
      view: {
        class: 'foam.u2.tag.TextArea',
        rows: 5,
        cols: 80
      },
      storageTransient: true
    },
    {
      name: 'foid',
      class: 'Object',
      visibility: 'RO'
      // TODO: parse with FUID to get DAO for link
    },
    {
      name: 'fObject',
      class: 'FObjectProperty',
      visibility: 'HIDDEN',
      transient: true,
      javaPostSet: `
      setFoid(val.getProperty("id"));
      `
    },
    // {
    //  ?? first byte of session? if not otherwise specified? Only helpful on user generated events. system and medusa will always be the same.
    //   name: 'traceId',
    //   class: 'String',
    //   updateVisibility: 'RO'
    // },
    {
      name: 'eventRecordResponse',
      class: 'FObjectProperty',
      of: 'foam.core.er.EventRecordResponse',
      visibility: 'RO',
      storageTransient: true
    },
    {
      name: 'exception',
      class: 'Object',
      updateVisibility : 'RO',
      view: {
        class: 'foam.u2.tag.TextArea',
        rows: 5,
        cols: 80
      },
      javaFormatJSON: 'formatter.output(get_(obj).toString());',
      javaPostSet: `
      if ( ! messageIsSet_ ) {
        if ( val instanceof Exception ) {
          setMessage(((Exception) val).getMessage());
        } else {
          setMessage(String.valueOf(val));
        }
      }
      `
    },
    {
      name: 'clusterable',
      class: 'Boolean',
      value: true,
      storageTransient: true
    },
    {
      name: 'raiseAlarm',
      class: 'Boolean',
      value: true,
    },
    {
      name: 'alarm',
      class: 'Reference',
      of: 'foam.core.alarming.Alarm',
      storageTransient: true,
      createVisibility: 'HIDDEN',
      visibility: 'RO',
      menuKeys: [
        'alarm',
        'admin.alarm'
      ]
    },
    {
      name: 'systemOutage',
      class: 'Reference',
      of: 'foam.core.so.SystemOutage'
    }
  ],

  methods: [
    {
      documentation: 'Summary used for Alarm name, so the components of the summary should not change between an event which raises an alarm and one that clears.',
      name: 'toSummary',
      type: 'String',
      code: function() {
        var str = '';
        if ( this.source ) {
          if ( str.length > 0 ) str += '-';
          str += this.source;
        }
        if ( this.event ) {
          if ( str.length > 0 ) str += '-';
          str += this.event;
        }
        if ( this.partner ) {
          if ( str.length > 0 ) str += '-';
          str += this.partner;
        }
        if ( this.code ) {
          if ( str.length > 0 ) str += '-';
          str += this.code;
        }
        if ( this.message ) {
          if ( str.length > 0 ) str += '-';
          str += this.message;
        }
        return str;
      },
      javaCode: `
      StringBuilder sb = new StringBuilder();
      if ( getSource() != null ) {
        if ( sb.length() > 0 ) {
          sb.append("-");
        }
        sb.append(getSource().toString());
      }
      if ( ! SafetyUtil.isEmpty(getEvent()) ) {
        if ( sb.length() > 0 ) {
          sb.append("-");
        }
        sb.append(getEvent());
      }
      if ( ! SafetyUtil.isEmpty(getPartner()) ) {
        if ( sb.length() > 0 ) {
          sb.append("-");
        }
        sb.append(getPartner());
      }
      if ( ! SafetyUtil.isEmpty(getCode()) ) {
        if ( sb.length() > 0 ) {
          sb.append("-");
        }
        sb.append(getCode());
      }
      if ( ! SafetyUtil.isEmpty(getMessage()) ) {
        if ( sb.length() > 0 ) {
          sb.append(",");
        }
        sb.append(getMessage());
      }
      return sb.toString();
      `
    },
    {
      documentation: 'Summary used for Alarm name, so the components of the summary should not change between an event which raises an alarm and one that clears.',
      name: 'alarmSummary',
      type: 'String',
      code: function() {
        var str = '';
        if ( this.source ) {
          if ( str.length > 0 ) str += '-';
          str += this.source;
        }
        if ( this.event ) {
          if ( str.length > 0 ) str += '-';
          str += this.event;
        }
        if ( this.partner ) {
          if ( str.length > 0 ) str += '-';
          str += this.partner;
        }
        return str;
      },
      javaCode: `
      StringBuilder sb = new StringBuilder();
      if ( getSource() != null ) {
        if ( sb.length() > 0 ) {
          sb.append("-");
        }
        sb.append(getSource().toString());
      }
      if ( ! SafetyUtil.isEmpty(getEvent()) ) {
        if ( sb.length() > 0 ) {
          sb.append("-");
        }
        sb.append(getEvent());
      }
      if ( ! SafetyUtil.isEmpty(getPartner()) ) {
        if ( sb.length() > 0 ) {
          sb.append("-");
        }
        sb.append(getPartner());
      }
      return sb.toString();
      `
    },
    {
      name: 'toLogSummary',
      type: 'String',
      javaCode: `
      StringBuilder sb = new StringBuilder();
      if ( getSource() != null ) {
        if ( sb.length() > 0 ) {
          sb.append(",");
        }
        sb.append(getSource().toString());
      }
      if ( ! SafetyUtil.isEmpty(getEvent()) ) {
        if ( sb.length() > 0 ) {
          sb.append(",");
        }
        sb.append(getEvent());
      }
      if ( ! SafetyUtil.isEmpty(getPartner()) ) {
        if ( sb.length() > 0 ) {
          sb.append(",");
        }
        sb.append(getPartner());
      }
      if ( ! SafetyUtil.isEmpty(getCode()) ) {
        if ( sb.length() > 0 ) {
          sb.append(",");
        }
        sb.append(getCode());
      }
      if ( ! SafetyUtil.isEmpty(getMessage()) ) {
        if ( sb.length() > 0 ) {
          sb.append(",");
        }
        sb.append(getMessage());
      }

      return sb.toString();
      `
    }
  ]
})
