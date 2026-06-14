/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.logger',
  name: 'LogMessage',

  documentation: 'Modelled log output.',

  javaImports: [
    'foam.lang.X',
    'foam.log.LogLevel',
    'foam.core.auth.User'
  ],

  tableColumns: [
    'created',
    'severity',
    'message'
  ],

  searchColumns: [
    'hostname',
    'created',
    'severity',
    'message'
  ],

  javaCode: `
    protected static ThreadLocal<foam.util.FastTimestamper> timestamper_ = new ThreadLocal<foam.util.FastTimestamper>() {
      @Override
      protected foam.util.FastTimestamper initialValue() {
        foam.util.FastTimestamper ft = new foam.util.FastTimestamper();
        return ft;
      }
    };
  `,

  properties: [
    {
      name: 'hostname',
      class: 'String',
      visibility: 'RO',
    },
    {
      name: 'created',
      class: 'Long',
      visibility: 'RO',
      javaFactory: 'return System.currentTimeMillis();',
      tableWidth: 180,
      view: 'foam.u2.view.date.ROMillisecondView',
      tableCellFormatter: function(value, obj, axiom) {
        this.add(new Date(value).toISOString());
      },
      // 'created' is stored as epoch millis (Long), so XML export emitted the
      // raw number. Mirror the tableCellFormatter and output a readable ISO
      // string instead. (formatDatesAsNumbers only governs real Date values.)
      toXML: function(value, Outputter) {
        return value ? new Date(value).toISOString() : value;
      }
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'createdBy',
      documentation: `The unique identifier of the user.`,
      visibility: 'RO',
      tableCellFormatter: function(value, obj, axiom) {
        this.__subSubContext__.userDAO
          .find(value)
          .then((user) => {
            if ( user ) {
              this.add(user.legalName);
            }
          })
          .catch((error) => {
            this.add(value);
          });
      }
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'createdByAgent',
      documentation: `The unique identifier of the agent`,
      visibility: 'RO',
      tableCellFormatter: function(value, obj, axiom) {
        this.__subSubContext__.userDAO
          .find(value)
          .then((user) => {
            if ( user ) {
              this.add(user.legalName);
            }
          })
          .catch((error) => {
            this.add(value);
          });
      }
    },
    {
      name: 'thread',
      class: 'String',
      visibility: 'RO',
      javaFactory: `return Thread.currentThread().getName();`,
    },
    {
      name: 'severity',
      class: 'Enum',
      of: 'foam.log.LogLevel',
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
      name: 'id',
      class: 'Long',
      storageTransient: 'true',
      visibility: 'HIDDEN'
    },
    {
      name: 'message',
      class: 'String',
      label: 'Log Message',
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 100 },
      updateVisibility: 'RO'
    },
    // TODO: implement via an additional method on Logger logger.flag(x, y).log(message)
    // {
    //   name: 'flags',
    //   class: 'Map'
    // },
    // {
    //   name: 'exception',
    //   class: 'Object',
    //   view: { class: 'foam.u2.view.PreView' },
    //   updateVisibility: 'RO'
    // }
  ],

  methods: [
    {
      name: 'toString',
      javaCode: `
      StringBuilder sb = new StringBuilder();
      sb.append(timestamper_.get().createTimestamp(getCreated()));
      sb.append(",");
      sb.append(getThread());
      sb.append(",");
      sb.append(getSeverity());
      sb.append(",");
      sb.append(getMessage());
      return sb.toString();
      `
    }
  ]
});
