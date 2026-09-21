/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.wizard.test',
  name: 'WizardIndicatorTokensJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `
    The wizard step indicators and exit button take their colours from CSS
    tokens resolved at render time. A token whose dark value equals the panel
    background makes the ring, its digit and the exit X vanish in dark mode,
    so this checks the resolved colours against both panel backgrounds in
    both colour modes, and that the wizard CSS no longer carries legacy
    %MACRO% colours that are dropped when the theme leaves them unset.
  `,

  requires: [
    'foam.u2.CSS',
    'foam.u2.tag.CircleIndicator',
    'foam.u2.wizard.IncrementalStepWizardView',
    'foam.u2.wizard.StepWizardletStepsView',
    'foam.u2.wizard.WizardletIndicator'
  ],

  methods: [
    function luminance(hex) {
      var c = hex.replace('#', '').match(/../g).map(function(h) {
        var v = parseInt(h, 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    },
    function contrast(a, b) {
      var l1 = this.luminance(a), l2 = this.luminance(b);
      if ( l1 < l2 ) { var t = l1; l1 = l2; l2 = t; }
      return (l1 + 0.05) / (l2 + 0.05);
    },
    async function runTest(x) {
      var self = this;
      var modes = { light: {}, dark: { color: 'dark' } };
      for ( var mode in modes ) {
        var ctx = x.createSubContext({
          theme: { activeVariants: modes[mode] },
          stack: {}, notify: function() {}
        });
        var steps = this.StepWizardletStepsView.create({}, ctx);
        var stepsPanel = steps.tok('$backgroundDefault');   // ^status of the wizard view
        var rightside  = steps.tok('$backgroundSecondary'); // ^rightside, where the exit X sits

        var ring = this.CircleIndicator.create(steps.configureIndicator(
          { indicator: this.WizardletIndicator.PLEASE_FILL }, false, 2), ctx);

        x.test(ring.textColor === ring.stateBorderColor_,
          mode + ': digit follows the ring colour (CircleIndicator default)');
        x.test(self.contrast(ring.stateBorderColor_, stepsPanel) >= 3,
          mode + ': upcoming ring ' + ring.stateBorderColor_ + ' on steps panel ' +
          stepsPanel + ' is ' + self.contrast(ring.stateBorderColor_, stepsPanel).toFixed(2) + ':1');
        x.test(self.contrast(ring.stateBorderColor_, rightside) >= 3,
          mode + ': upcoming ring ' + ring.stateBorderColor_ + ' on rightside ' +
          rightside + ' is ' + self.contrast(ring.stateBorderColor_, rightside).toFixed(2) + ':1');

        var wizard = this.IncrementalStepWizardView.create({}, ctx);
        x.test(foam.Function.isInstance(wizard.tok),
          mode + ': IncrementalStepWizardView resolves tokens through the mixin helper');

        var css = this.CSS.create({ code: this.IncrementalStepWizardView.model_.css }, ctx)
          .expandCSS(this.IncrementalStepWizardView, this.IncrementalStepWizardView.model_.css, ctx);
        var macros = css.match(/%[A-Z0-9_]+%/g) || [];
        x.test(macros.length === 0,
          mode + ': wizard CSS carries no legacy theme macros' +
          ( macros.length ? ' (found ' + macros.join(', ') + ')' : '' ));
      }
    }
  ]
});
