/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.comics.v2.test',
  name: 'DAOBrowseControllerViewTest',
  extends: 'foam.core.test.JSTest',

  documentation: `DAOBrowseControllerView renders its header from DAOControllerConfig.
    It once read config.browseActions and config.browseContext after both were
    removed from the config (1fd8f18b, 6b72eefea8), and every screen using it
    threw on open.`,

  requires: [
    'foam.comics.v2.DAOBrowseControllerView',
    'foam.comics.v2.DAOControllerConfig',
    'foam.comics.v2.namedViews.NamedViewCollection',
    'foam.dao.MDAO'
  ],

  methods: [
    async function runTest(x) {
      var wait  = ms => new Promise(res => setTimeout(res, ms));
      // Models are made here, not at load, so NamedViewCollection is loaded.
      var model = (name, views) => {
        foam.CLASS({
          package: 'foam.comics.v2.test',
          name: name,
          axioms: views.map(v => this.NamedViewCollection.create({ name: v, view: { class: 'foam.u2.View' }, icon: 'images/list-view.svg' })),
          properties: [ 'id' ]
        });
        return foam.lookup('foam.comics.v2.test.' + name);
      };
      var M     = model('DAOBrowseControllerViewTestTwo', [ 'One', 'Two' ]);
      var ctx   = x.createSubContext({ stack: { push() {}, back() {} } });
      var dao   = this.MDAO.create({ of: M }, ctx);
      var check = async function(of, label) {
        var config = this.DAOControllerConfig.create({ of: of, dao: dao, browseTitle: 'Things' }, ctx);
        var view   = this.DAOBrowseControllerView.create({ data: dao, config: config, showNav: false }, ctx);
        var error  = null;
        try {
          view.write();
          await wait(100);
        } catch (e) { error = e; }
        x.test(! error, label + ': renders without throwing' + ( error ? ', got ' + error : '' ));
        var el = view.element_;
        x.test(el && el.textContent.includes('Things'), label + ': shows the browse title');
        var switcher = el && el.querySelector('.foam-u2-view-IconChoiceView');
        el && el.remove();
        view.detach();
        return !! switcher;
      }.bind(this);

      x.test(await check(M, 'two named views') === true,
        'two named views: the view switcher is shown');

      var plain = model('DAOBrowseControllerViewTestOne', [ 'One' ]);
      x.test(await check(plain, 'one named view') === false,
        'one named view: no view switcher');
    }
  ]
});
