/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'AltViewSelectorJSTest',
  extends: 'foam.core.test.JSTest',

  documentation: `AltView's switch is selectorView. With a drop-down as the switch a person
    sees a drop-down, not radio buttons, and picking a view in it shows that view. With nothing
    set, the switch is the radio buttons it always was, with the first view picked, and it follows
    a pick made in code or by a change to the address while it is open. A label in the address
    when it opens (a reload) wins over a default the screen sets.`,

  requires: [
    'foam.u2.memento.Memento',
    'foam.u2.view.AltView'
  ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var self = this;
        // two views that draw different text; made here, not in classes:, so no Java is generated for them
        foam.CLASS({ package: 'foam.u2.test', name: 'AltViewSelectorFirstView',  extends: 'foam.u2.View',
          methods: [ function render() { this.add('First view'); } ] });
        foam.CLASS({ package: 'foam.u2.test', name: 'AltViewSelectorSecondView', extends: 'foam.u2.View',
          methods: [ function render() { this.add('Second view'); } ] });
        async function until(f) {
          for ( var i = 0 ; i < 100 && ! f() ; i++ ) await new Promise(r => setTimeout(r, 20));
          return f();
        }
        function alt(args, str) {
          // its own address, not the page's: a pick in one AltView must not open the next on that view
          var address = self.Memento.create({ obj: self, str: str || '' }, x);
          var view = self.AltView.create(Object.assign({
            views: [ [ { class: 'foam.u2.test.AltViewSelectorFirstView' }, 'One' ], [ { class: 'foam.u2.test.AltViewSelectorSecondView' }, 'Two' ] ]
          }, args), x.createSubContext({ memento_: address }));
          view.write();
          return view;
        }
        function shows(view, text) { return view.element_.innerText.indexOf(text) !== -1; }

        // A drop-down as the switch
        var a = alt({ selectorView: { class: 'foam.u2.view.ChoiceView' } });
        var select = a.element_.querySelector('select');
        x.test(!! select && a.element_.querySelectorAll('input[type=radio]').length === 0,
          'with a drop-down as selectorView the switch is a drop-down, not radio buttons');
        if ( select ) {
          x.test(await until(() => select.options[select.selectedIndex]?.text === 'One'),
            'the drop-down shows the first view picked, got "' + select.options[select.selectedIndex]?.text + '"');
          x.test(shows(a, 'First view') && ! shows(a, 'Second view'), 'and the first view is on screen');

          select.selectedIndex = Array.from(select.options).findIndex(o => o.text === 'Two');
          select.dispatchEvent(new Event('change'));
          x.test(await until(() => shows(a, 'Second view') && ! shows(a, 'First view')),
            'picking Two in the drop-down shows the second view');
        }
        a.remove();

        // Nothing set: the radio buttons, the first view picked; the switch follows a pick in code or by the address
        var b = alt({});
        var radios = () => Array.from(b.element_.querySelectorAll('input[type=radio]'));
        x.test(await until(() => radios().length === 2), 'with no selectorView the switch is two radio buttons, got ' + radios().length);
        x.test(await until(() => radios()[0]?.checked && ! radios()[1]?.checked) && shows(b, 'First view'),
          'the first radio button is picked and the first view is on screen');

        radios()[1]?.click();
        x.test(await until(() => shows(b, 'Second view') && ! shows(b, 'First view')), 'clicking the second radio button shows the second view');

        b.selectedView = 'One';
        x.test(await until(() => radios()[0]?.checked && shows(b, 'First view')),
          'a pick made in code checks the first radio button and shows the first view');

        b.selectedViewLabel = 'Two';
        x.test(await until(() => radios()[1]?.checked && shows(b, 'Second view')),
          'a label set by the address while the view is open (a link, a typed address) checks the second radio button and shows the second view');

        b.selectedViewLabel = 'Bogus';
        x.test(await until(() => radios()[1]?.checked && shows(b, 'Second view')),
          'a label that names no view keeps the shown view, and its radio button stays checked');
        b.remove();

        // A reload: the address names Two and the screen's default is One; the address wins
        var c = alt({ selectedView: 'One' }, 'selectedViewLabel=Two');
        var cRadios = () => Array.from(c.element_.querySelectorAll('input[type=radio]'));
        x.test(await until(() => cRadios()[1]?.checked && shows(c, 'Second view') && ! shows(c, 'First view')),
          'a reload with Two in the address opens on Two, even when the screen\'s default is One');
        c.remove();
      }
    }
  ]
});
