/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailGeneric',
  extends: 'foam.parse.rail.RailTerminal',

  documentation: `
    Grey square-cornered box showing the class name of a parser the builder
    has no drawing for. Never throws; the enumeration test treats one of these
    for a known foam.parse class as a failure.
  `,

  constants: { CORNER_RADIUS: 3 },

  methods: [
    function fillToken() { return 'generic'; }
  ]
});
