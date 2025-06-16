/**
* @license
* Copyright 2024 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'Router',
  extends: 'foam.u2.Controller',
  implements: [ 'foam.u2.Routable' ],

  mixins: [ 'foam.u2.memento.Memorable' ],

  documentation: `A special type of controller class that simplifies handling of breadcrumbs, stacks and mementos.
    Routers must instantiate using the addCrumb() (usually in the init()).
  `,

  imports: ['breadcrumbs?', 'stack?'],
  exports: [ 'route' ],

  // topics: ['routedTo'],
  properties: [
    {
      name: 'route',
      memorable: true,
      transient: true
    },
    {
      name: 'routingFeedback_',
      value: false,
      transient: true
    }
  ],

  methods: [
    function addCrumb() {
      // Simplest implementation of adding breadcrumbs, other routers
      // might need something more complex
      this.breadcrumbs?.push(this);
      this.dynamic(function(route) {
        this.routeChange();
      })
    },
    function routeToMe() {
      if ( this.routingFeedback_ ) return;
      if ( this.isDetached() ) {
        console.error('******routing to a detached controller');
        return;
      }
      this.routingFeedback_ = true;
      this.clearProperty('route');
      this.routingFeedback_ = false;
    },
    function routeChange() {
      if ( this.routingFeedback_ ) return;
      this.routingFeedback_ = true;
      if ( ! this.route ) {
        this.getPrivate_('crumb')?.go();
      }
      this.routingFeedback_ = false;
    }
  ]
});


// Used to test if classes mixing in Router are routeable
foam.INTERFACE({
  package: 'foam.u2',
  name: 'Routable'
});
