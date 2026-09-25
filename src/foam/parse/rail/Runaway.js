/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'Runaway',
  documentation: 'Thrown from the trace apply hook when a parse exceeds its event budget (a loop over something that can match nothing).',
  properties: [ { class: 'Int', name: 'events' } ]
});
