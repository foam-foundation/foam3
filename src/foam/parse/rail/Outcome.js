/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.ENUM({
  package: 'foam.parse.rail',
  name: 'Outcome',

  documentation: `
    What a parser did in the part of a trace that has been applied. Also the
    single table for the corner glyph every box paints beside its label, so
    state never depends on colour alone.
  `,

  properties: [
    { class: 'String', name: 'mark', documentation: 'Corner glyph on boxes; empty for NONE. (Named mark: every FOAM enum already has a glyph property.)' }
  ],

  values: [
    { name: 'NONE',    label: 'not reached', mark: '' },
    { name: 'TRYING',  label: 'trying',      mark: '▶' },
    { name: 'MATCHED', label: 'matched',     mark: '✓' },
    { name: 'FAILED',  label: 'failed',      mark: '✗' }
  ]
});
