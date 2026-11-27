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
    place of its label between the two clicks, and keeps its width. Before
    and after, and on a button that never asks, a person reads the action's
    own label and nothing else.`,

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
        x.test(plain.element_.innerText.trim() === 'Open', 'a button that never asks reads as its label, got "' + plain.element_.innerText + '"');
        plain.click();
        x.test(calls === 1, 'one click runs it');
        x.test(plain.element_.innerText.trim() === 'Open', 'and it still reads as its label, got "' + plain.element_.innerText + '"');
        plain.remove();

        calls = 0;
        var asks = button(this.Action.create({
          name: 'remove',
          confirmationRequired: function() { return true; },
          code: function() { calls++; }
        }));
        x.test(asks.element_.innerText.trim() === 'Remove', 'before the first click a button that asks reads as its label, got "' + asks.element_.innerText + '"');
        var width = asks.element_.offsetWidth;

        asks.click();
        x.test(await until(() => asks.element_.innerText.trim() === 'Confirm'), 'the first click shows Confirm alone, got "' + asks.element_.innerText + '"');
        x.test(calls === 0, 'and does not run the action');
        var shown = Array.from(asks.element_.children).filter(c => c !== confirmEl(asks) && getComputedStyle(c).display !== 'none' && c.textContent);
        x.test(shown.length === 0, 'the action\'s own label is hidden while it asks, still shown: "' +
          shown.map(c => c.textContent).join('", "') + '"');
        x.test(! width || asks.element_.style.minWidth === width + 'px',
          'the button keeps the width it had, got "' + asks.element_.style.minWidth + '" for ' + width);

        x.test(await until(() => asks.buttonState === asks.ButtonState.ARMED), 'it arms after the debounce');
        asks.click();
        x.test(calls === 1, 'the second click runs the action');
        x.test(await until(() => asks.element_.innerText.trim() === 'Remove'), 'and it reads as its label again, got "' + asks.element_.innerText + '"');
        x.test(asks.element_.style.minWidth === '', 'and the kept width is released');
        asks.remove();
      }
    }
  ]
});
