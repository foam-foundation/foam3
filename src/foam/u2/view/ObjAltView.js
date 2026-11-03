/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ObjAltView',
  extends: 'foam.u2.View',

  mixins: ['foam.u2.memento.Memorable'],

  requires: [ 'foam.u2.view.RadioView' ],

  documentation: "Like AltView, but for Objects instead of DAO's.",

  css: `
    << { margin: auto; }
    << .foam-u2-view-RadioView.foam-u2-view-RadioView-horizontal-radio .choice {
      display: inline-flex;
    }
    << .property-selectedView { margin-bottom: 6px; }
  `,

  properties: [
    {
      name: 'of',
      factory: function() { return this.data.of }
    },
    {
      name: 'views',
      factory: function() { return []; }
    },
    {
      name: 'selectedView',
      view: function(_, X) {
        return X.data.RadioView.create(
          {choices: X.data.views, isHorizontal: true, columns: 8},
          X.createSubContext({controllerMode: foam.u2.ControllerMode.EDIT})
        );
      },
      postSet: function(_, n) {
        var view = this.views.find(v => v[0] === n);
        if ( view ) {
          this.selectedViewLabel = view[1];
        } else {
          this.selectedViewLabel = null;
        }
      }
    },
    {
      name: 'selectedViewLabel',
      memorable: true
    },
    {
      name: 'data'
    },
    'currentMemento_'
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      if ( this.selectedViewLabel ) {
        var view = this.views.find(v => v[1] === this.selectedViewLabel);
        if ( view ) {
          this.selectedView = view[0];
        } else {
          this.selectedView = this.views[0][0];
        }
      } else {
        this.selectedView = this.views[0][0];
      }

      this.addClass();
      this.startContext({data: this})
        this.start()
          .add(this.SELECTED_VIEW)
        .end()
      .endContext()
      .start('div')
        .add(this.selectedView$.map(function(v) {
          return self.E().tag(v, {data$: self.data$});
        }))
      .end();
    }
  ]
});
