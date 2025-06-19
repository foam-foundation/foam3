/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.push',
  name: 'PushNotificationClickAgent',

  documentation: `Client-side CSpec which is called by the serviceWorker and 
  ios app when a user clicks on the notification. Uses the notification's extra 
  as it's arguments.
  
  HOW TO USE:
    - Refine in your own project repo to add to the returnFunctionMapping 
    - Extend this service to provide extra functionality such as adding support for more listeners
  `,

  imports: [ 'pushRegistry', 'window', 'client' ],

  requires: ['foam.lang.Latch'],

  properties: [
    {
      class: 'String',
      name: 'pushEventName',
      documentation: `Event name pubbed to when a user clicks on a notification by 
      both the service worker for web/android notifications and the ios app`,
      value: 'push-click'
    }
  ],

  methods: [
    function init() {
      // This agent runs in two phases:
      // 1. if a notification is clicked while the app is closed, the app is opened with the notification data in the URL search params
      // 2. if the app is already open, the notification click event is dispatched by the service worker or ios app
      // The first phase is required as the linsteners wont be set up until the app is fully loaded, so we need to handle the case where the app is opened with a notification click.

      // Phase 1: Check if the app was opened with a notification click
      let url = new URL(this.window.location.href);
      this.serviceName = url.searchParams.get('service');
      let clickedNotification = url.searchParams.get(this.pushEventName);
      if ( clickedNotification ) {
        let data = JSON.parse(decodeURIComponent(clickedNotification));
        this.clickListener(data);
        // Recheck current url in case there was a change in the route
        url = new URL(this.window.location.href);
        url.searchParams.delete(this.pushEventName);
        history.replaceState({}, '', url);
      }

      // Phase 2: Listen for notification click events
      // Distached by the ios app through WebView message handlers
      this.window.addEventListener(this.pushEventName, event => {
        this.clickListener(event.detail);
      });
      // Distached by the service worker for web/android notifications
      navigator.serviceWorker.addEventListener("message", (args) => {
        let { msg, data } = args.data;
        if ( msg !== this.pushEventName ) return;
        this.clickListener(data);
      });
    },
    function clickListener(args) {
      let functionMap = this.returnFunctionMapping() ?? {};
      Object.keys(args).forEach((key) => {
        if ( functionMap[key] ) {
          functionMap[key].call(this, args[key])
        }
      })
    },
    /* 
     * When the notification is carrying a key which matches the a key in the reutrned map, 
     * the corresponding function will be executed. See the default behaviour for an example.
     * The value of the key from the notification is passed to the function.
     */
    function returnFunctionMapping() {
      return {
        'launchRoute': function(val) {
          this.__subContext__.routeTo(val);
        },
        'redirectUrl': function(val) {
          this.__subContext__.window.open(val);
        }
      }
    }
  ]
});
