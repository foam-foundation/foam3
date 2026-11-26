/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.wizard.agents',
  name: 'AnalyticEventsAgent',
  implements: [ 'foam.lang.ContextAgent' ],

  requires: ['foam.core.analytics.AnalyticEvent'],

  imports: [
    'logAnalyticEvent',
    'window'
  ],

  exports: [
    'analyticsAgent',
    'wizardTraceID'
  ],

  topics: ['analyticsAgent'],

  properties: [
    {
      class: 'String',
      name: 'wizardName',
      documentation: 'name to be logged when the wizard is started'
    },
    {
      class: 'foam.u2.wizard.PathProperty',
      name: 'traceIDKey',
      documentation: 'Context key for preferred traceID of AnalyticEvent'
    },
    {
      class: 'foam.u2.wizard.PathProperty',
      name: 'objectIDKey',
      documentation: 'Context key for preferred objectID of AnalyticEvent'
    },
    {
      class: 'Boolean',
      name: 'logDeviceInfo',
      value: true
    },
    {
      class: 'Boolean',
      name: 'createTraceID',
      value: false
    },
    {
      class: 'String',
      name: 'wizardTraceID'
    }
  ],
  methods: [
    function execute() {
      var self = this;
      this.analyticsAgent.sub('event', function(_, __, ___, evt) {
        self.logAnalyticEvent({
          name:     evt.name,
          extra:    evt.extra,
          traceId:  self.traceIDKey$get(self.__subContext__) || self.wizardTraceID,
          objectId: self.objectIDKey$get(self.__subContext__)
        });
      });

      if (this.createTraceID && !this.traceIdKey) {
        this.wizardTraceID = foam.uuid.randomGUID();
      }

      // TODO: Temp fix for 3.20 iframe logging
      this.window.analyticsAgent = this.analyticsAgent;

      for ( const method of ['error' /*, 'warn' */] ) { // disabling logging console.warns for now
        const delegate = console[method].bind(console);
        console[method] = (...a) => {
          delegate(...a);
          if ( a[0] && typeof a[0] === 'string' && a[0].startsWith('Expression returned undefined') ) {
            // This warnings happen too frequently to be useful
            return;
          }

          if ( a.length == 1 && a[0] === '' )
            a[0] = new Error("Empty console error log").stack;

          this.analyticsAgent.pub('event', {
            name: 'CONSOLE_' + method.toUpperCase(),
            extra: foam.json.stringify(a)
          });
        };
      }
      if ( this.wizardName ) {
        this.analyticsAgent.pub('event', {
          name: this.wizardName + '_STARTED',
        });
      }

      // Log device info
      if ( this.logDeviceInfo ) {
        this.analyticsAgent.pub('event', {
          name: 'USER_AGENT',
          extra: foam.json.stringify({ model: this.window.navigator.userAgent })
        });

        this.analyticsAgent.pub('event', {
          name: 'SCREEN_RESOLUTION',
          extra: foam.json.stringify({ screenResolution: `${this.window.screen.width}x${this.window.screen.height}` })
        });

        this.analyticsAgent.pub('event', {
          name: 'WINDOW_RESOLUTION',
          extra: foam.json.stringify({ resolution: `${this.window.innerWidth}x${this.window.innerHeight}` })
        });
      }
    }
  ]
});
