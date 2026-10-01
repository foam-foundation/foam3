/**
* @license
* Copyright 2026 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.view',
  name: 'RelativeDateTimeView',
  extends: 'foam.u2.view.DateTimeView',

  documentation: `A DateTime property view whose read mode renders the value
    as a relative time string ("3 hours ago") with the absolute timestamp in
    a tooltip, and whose write mode is the standard DateTime editor. Drop-in
    for any DateTime/DateTimeUTC property where recency matters more than
    the exact timestamp:
      view: { class: 'foam.u2.view.RelativeDateTimeView' }`,

  requires: [ 'foam.u2.view.RORelativeDateTimeView' ],

  properties: [
    {
      name: 'readView',
      factory: function() {
        return { class: 'foam.u2.view.RORelativeDateTimeView' };
      }
    }
  ]
});
