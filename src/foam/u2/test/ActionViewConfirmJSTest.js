/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'ActionViewConfirmJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `An action button that asks to confirm shows "Confirm" in
    place of its label between the two clicks, and keeps its width. A button
    that is not asking, or never asks, holds its own label and nothing else:
    no hidden "Confirm" for a script or a test to read as part of its text.`,

  requires: [
    'foam.lang.Action',
    'foam.u2.ActionView'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var self  = this;
        var calls = 0;
        var data  = foam.lang.FObject.create({}, x);

        function button(action) {
          var view = self.ActionView.create({ action: action, data: data }, x);
          view.write();
          return view;
        }
        function confirmEl(view) { return view.element_.querySelector('.' + view.myClass('confirm')); }
        async function until(f) {
          for ( var i = 0 ; i < 100 && ! f() ; i++ ) await new Promise(r => setTimeout(r, 20));
          return f();
        }

        var plain = button(this.Action.create({ name: 'open', code: function() { calls++; } }));
        x.test(confirmEl(plain) === null, 'a button that never asks holds no "Confirm" label');
        x.test(plain.element_.textContent === 'Open', 'its text is its label, got "' + plain.element_.textContent + '"');
        plain.click();
        x.test(calls === 1 && confirmEl(plain) === null, 'one click runs it, still no "Confirm" label');
        plain.remove();

        calls = 0;
        var asks = button(this.Action.create({
          name: 'remove',
          confirmationRequired: function() { return true; },
          code: function() { calls++; }
        }));
        x.test(confirmEl(asks) === null, 'before the first click a button that asks holds no "Confirm" label');
        x.test(asks.element_.textContent === 'Remove', 'its text is its label, got "' + asks.element_.textContent + '"');
        var width = asks.element_.offsetWidth;

        asks.click();
        x.test(await until(() => confirmEl(asks) !== null), 'the first click shows "Confirm"');
        x.test(calls === 0, 'and does not run the action');
        x.test(confirmEl(asks) && confirmEl(asks).textContent === 'Confirm', 'the label says Confirm');
        var shown = Array.from(asks.element_.children).filter(c => c !== confirmEl(asks) && getComputedStyle(c).display !== 'none' && c.textContent);
        x.test(shown.length === 0, 'the action\'s own label is hidden while it asks, still shown: "' +
          shown.map(c => c.textContent).join('", "') + '"');
        x.test(asks.element_.innerText.trim() === 'Confirm', 'the button reads Confirm and nothing else, got "' + asks.element_.innerText + '"');
        x.test(! width || asks.element_.style.minWidth === width + 'px',
          'the button keeps the width it had, got "' + asks.element_.style.minWidth + '" for ' + width);

        x.test(await until(() => asks.buttonState === asks.ButtonState.ARMED), 'it arms after the debounce');
        asks.click();
        x.test(calls === 1, 'the second click runs the action');
        x.test(await until(() => confirmEl(asks) === null), 'and the "Confirm" label is gone');
        x.test(asks.element_.textContent === 'Remove', 'the text is the label again, got "' + asks.element_.textContent + '"');
        x.test(asks.element_.style.minWidth === '', 'and the kept width is released');
        asks.remove();
      }
    }
  ]
});
