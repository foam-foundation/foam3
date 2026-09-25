/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.rail',
  name: 'RailTheme',
  extends: 'foam.graphics.CViewTheme',

  documentation: `
    Colours, fonts and geometry for the railroad viewer. Geometry lives here as
    constants so every element and test reads one table. Values were tuned on
    real grammars: the heaviest stroke a state can reach must still leave a full
    curve radius of clear space beside every box.
  `,

  constants: {
    // Boxes
    PAD:        8,     // inside a box, left/right of the label
    GLYPH_SLOT: 11,    // column reserved on the left of every box for the outcome glyph
    BOX_H:      28,
    // Tracks
    GAP:        26,    // between items on one sequence track
    VGAP:       18,    // between stacked branches
    ARC:        14,    // curve radius
    LOOP_PAD:   32,    // horizontal room reserved for a detour column on each side
    BEND:       1.6,   // detour column sits BEND * ARC in from the element edge
    BYPASS_HEADROOM: 2.4,  // optional bypass runs BYPASS_HEADROOM * ARC above the item
    // Unfolded frame and strip
    FRAME_HEAD: 20,
    FRAME_PAD:  10,
    LABEL_W:    90,    // rule-name column, minimum; the scene widens it to the longest name + LABEL_GAP
    LABEL_GAP:  12,    // clear space between the longest rule name and the entry dot
    STUB:       14,    // entry/exit stub between the label column and the track
    STRIP_GAP:  28,    // vertical gap between strips
    CANVAS_MARGIN: 20, // strips start this far from the scene origin
    TERMINATOR_RADIUS: 4,  // entry dot
    END_STOP_W: 3,         // exit bar
    END_STOP_H: 12,
    // Priority numbers on branches
    PRIORITY_DX: 14,   // left of the branch entry
    PRIORITY_DY: 11,   // above the branch row
    PRIORITY_RADIUS: 7,
    // Stroke weights (px). State is encoded by weight as well as hue.
    STROKE_BASE: 1,
    STROKE_VISITED: 2,
    STROKE_HIGHLIGHT: 3,
    STROKE_PULSE: 3,   // extra width at pulse = 1, decaying to 0
    BRANCH_STROKE: 1.5,
    BRANCH_STROKE_VISITED: 2.5,
    RULE_LABEL_FLASH_ALPHA: 0.35
  },

  cssTokens: [
    // Colours for the HTML panels around the diagram (page, derivation, document view),
    // referenced as $foam.parse.rail.RailTheme.<name> so every panel shares one palette.
    // The outcome colours repeat the Okabe-Ito values in colors below, so a panel row
    // and the box it points at always match.
    { name: 'ink',            value: '#222' },     // body text
    { name: 'inkSecondary',   value: '#444' },     // headings, legend text
    { name: 'inkMuted',       value: '#6b6b6b' },  // hints, spans, counts
    { name: 'inkUnreached',   value: '#888' },     // document text the parse never reached
    { name: 'inkOnDark',      value: '#fff' },     // text on a coloured chip or the tooltip
    { name: 'line',           value: '#ccc' },     // panel borders
    { name: 'lineSoft',       value: '#e4e4e4' },  // section dividers
    { name: 'matched',        value: '#0072B2' },  // Outcome MATCHED
    { name: 'trying',         value: '#E69F00' },  // Outcome TRYING
    { name: 'tryingText',     value: '#B87A00' },  // TRYING as text: darker, readable on white
    { name: 'failed',         value: '#D55E00' },  // Outcome FAILED
    { name: 'terminalBorder', value: '#d9c98d' },  // edge of a terminal chip (fill is colors.terminalBg)
    { name: 'filterBorder',   value: '#f0d890' }   // edge of the derivation filter bar
  ],

  properties: [
    {
      name: 'colors',
      factory: function() {
        return {
          track: '#555', text: '#222', muted: '#777',
          terminalBg: '#fff7d6', ruleRefBg: '#e8f0ff', frameBg: 'rgba(232,240,255,0.35)',
          genericBg: '#e5e5e5', gateBg: '#f3f3f3',
          // Okabe-Ito, colourblind-safe; no green/red pair anywhere. One token per Outcome name.
          outcomeNONE: '#555', outcomeTRYING: '#E69F00', outcomeMATCHED: '#0072B2', outcomeFAILED: '#D55E00',
          consumedBg: '#d6e8f5', failBg: '#f8d9c4',
          tooltipBg: '#222', tooltipBorder: '#222', tooltipText: '#fff'
        };
      }
    },
    {
      name: 'fonts',
      factory: function() {
        return {
          label:    '13px sans-serif',        // box labels
          badge:    'bold 9px sans-serif',    // ×1+, aA, run counters
          glyph:    'bold 11px sans-serif',   // ✓ ▶ ✗
          ruleName: 'bold 13px monospace',    // strip label column
          priority: 'bold 10px sans-serif',   // branch numbers
          tooltip:  '12px monospace',
          ribbon:   '15px monospace',
          value:    '9px monospace'          // value tags under boxes, value lanes under strips
        };
      }
    },
    { class: 'String', name: 'background', value: '#fafafa' }
  ],

  methods: [
    function outcomeColor(outcome) {
      /** Colour token for an Outcome enum value: "outcome" + its name. */
      return this.resolve('outcome' + outcome.name);
    }
  ]
});
