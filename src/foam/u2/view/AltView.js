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
    Ex. views: [[ { class: 'foam.u2.table.TableView' }, 'Table' ]]
    The switch is selectorView (radio buttons unless set): any choice view, given the views' labels.`,

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
    << .property-selectedViewLabel { margin-bottom: 6px; }
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
      documentation: `The switch: any choice view. It draws selectedViewLabel, so it is given choices as
        [label, label] pairs and data as the picked view's label.`,
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
      },
      postSet: function(old, nu) {
        // the first set is a default (a create arg or the factory): a label the address
        // already gave wins, and render applies it
        if ( old === undefined && this.selectedViewLabel ) return;
        var view  = this.views.find(v => v[0] === nu);
        var label = view ? view[1] : '';
        if ( this.selectedViewLabel !== label ) this.selectedViewLabel = label;
      }
    },
    {
      class: 'String',
      name: 'selectedViewLabel',
      documentation: 'The label of the picked view. The switch draws it, and the address keeps it.',
      memorable: true,
      // an address with no label gives '' (not undefined), so postSet runs
      fromString: function(s) { return s || ''; },
      view: function(_, X) {
        // labels as values: a choice view that holds text can draw them
        return foam.u2.ViewSpec.createView(X.data.selectorView,
          { choices: X.data.views.map(v => [ v[1], v[1] ]) }, X.data, X);
      },
      postSet: function(_, nu) {
        var view = this.views.find(v => v[1] === nu);
        if ( view ) {
          if ( view[0] !== this.selectedView ) this.selectedView = view[0];
        } else if ( this.hasOwnProperty('selectedView') ) {
          // names no view (a stale address): keep the shown view and put its label back
          this.selectedView = this.selectedView;
        }
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      // views may have arrived after the label (the address) or after selectedView (an arg):
      // apply the address's label, or set selectedView again so its postSet writes the label
      var fromAddress = this.views.find(v => v[1] === this.selectedViewLabel);
      this.selectedView = fromAddress ? fromAddress[0] : this.selectedView;

      this.addClass()
      this.startContext({data: this})
        this.start()
          .add(this.SELECTED_VIEW_LABEL)
        .end()
      .endContext()
      .start('div')
        .add(this.selectedView$.map(function(v) {
          if ( foam.String.isInstance(v) ) v = { class: v };
          return self.E().tag(v, {data$: self.data$});
        }))
      .end();
    }
  ]
});
