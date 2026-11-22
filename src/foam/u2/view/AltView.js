/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'AltView',
  extends: 'foam.u2.View',

  mixins: ['foam.u2.memento.Memorable'],

  documentation: `Provides the ability to switch between multiple views for a data set.
    Takes a views property which should be the value of an array containing arrays that contain desired views, and label.
    Ex. views: [[ { class: 'foam.u2.table.TableView' }, 'Table' ]]`,

  css: `
    << {
      margin: auto; width: 100%;
      display: flex;
      height: 100%;
      flex-direction: column;
    }
    << > div:last-child {
      flex: 1;
      /* This min-height: 0 is required as it sets the base height for the height of the contents rendered by
         altview. This means the above flex: 1 doesnt make the content overflow this div */
      min-height: 0;
    }
    << .property-selectedView { margin-bottom: 6px; }
    << .foam-u2-view-RadioView.foam-u2-view-RadioView-horizontal-radio .choice {
      display: inline-flex;
    }
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
      class: 'foam.u2.ViewSpec',
      name: 'selectorView',
      documentation: `The control that picks a view: any choice view. It is given choices, a list of
        [label, label], and data, the label of the picked view.`,
      value: { class: 'foam.u2.view.RadioView', isHorizontal: true, columns: 8 }
    },
    {
      name: 'selectedView',
      documentation: `Set one of the views as the selectedView.

        Default to the first item of the views property.

        Set selectedView as a string to look up and load the view by name, or as
        a number to load the view by index.

        For example:
        {
          class: 'foam.u2.view.AltView',
          views: [
            [
              {
                // view 1 spec
              },
              'View 1'
            ],
            [
              {
                // view 2 spec
              },
              'View 2'
            ]
          ],
          selectedViewLabel: 'View 2' // select view by name
        }
      `,
      factory: function() {
        return this.views[0][0];
      },
      adapt: function(_, nu) {
        if ( typeof nu === 'string' ) {
          for ( var i = 0; i < this.views.length; i++ ) {
            if ( this.views[i][1] === nu ) {
              return this.views[i][0];
            }
          }
        } else if ( typeof nu === 'number' ) {
          return this.views[nu][0];
        }
        return nu;
      }
    },
    {
      class: 'String',
      name: 'selectedViewLabel',
      memorable: true
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      if ( this.selectedViewLabel ) {
        var viewSelectedWithMemento = this.views.find(v => foam.Array.isInstance(v) && v[1] == this.selectedViewLabel);
        if ( viewSelectedWithMemento ) {
          this.selectedView = viewSelectedWithMemento[1];
        } else {
          this.selectedViewLabel = '';
        }
      }

      // The selector works on labels (text), so any choice view can be the selector.
      var label = foam.lang.SimpleSlot.create();
      this.onDetach(this.selectedView$.relateTo(label,
        function(v) { var view = self.views.find(w => w[0] == v); return view ? view[1] : ''; },
        function(l) { var view = self.views.find(w => w[1] == l); return view ? view[0] : self.selectedView; }));

      this.addClass()
      this.start().addClass('property-selectedView')
        .tag(this.selectorView, { choices: this.views.map(v => [ v[1], v[1] ]), data$: label })
      .end()
      .start('div')
        .add(this.selectedView$.map(function(v) {
          if ( foam.String.isInstance(v) ) v = { class: v };
          return self.E().tag(v, {data$: self.data$});
        }))
      .end();

      this.onDetach(this.selectedView$.sub(function() {
        self.setMementoWithSelectedView();
      }));
    }
  ],

  actions: [
    function setMementoWithSelectedView() {
      if ( ! this.memento_ ) return;
      var view = this.views.find(v => v[0] == this.selectedView);
      this.selectedViewLabel = view ? view[1] : '';
    }
  ]
});
