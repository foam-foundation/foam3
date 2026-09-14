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
    { class: 'String', name: 'glyph', documentation: 'Corner glyph on boxes; empty for NONE.' }
  ],

  values: [
    { name: 'NONE',    label: 'not reached', glyph: '' },
    { name: 'TRYING',  label: 'trying',      glyph: '▶' },
    { name: 'MATCHED', label: 'matched',     glyph: '✓' },
    { name: 'FAILED',  label: 'failed',      glyph: '✗' }
  ]
});
