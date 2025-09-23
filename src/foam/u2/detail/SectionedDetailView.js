/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.detail',
  name: 'SectionedDetailView',
  extends: 'foam.u2.detail.AbstractSectionedDetailView',

  requires: [
    'foam.u2.detail.SectionView',
    'foam.u2.layout.Grid',
    'foam.u2.layout.GUnit',
    'foam.u2.borders.CardBorder'
  ],

  css: `
    ^ .foam-u2-table-TableView table {
      width: 100%;
    }
    ^card-container {
      display: flex;
      gap: 8px;
      flex-direction: column;
    }
  `,

  properties: [
    {
      class: 'Map',
      name: 'borders',
      documentation: `Map of borders for each section in the format of  { sectionName: {sectionBorderSpec} }`
    },
    {
      class: 'Boolean',
      name: 'showTitle',
      value: true
    }
  ],

  methods: [
    function render() {
      var self = this;

      this.SUPER();
      this
        .addClass(this.myClass())
        .add(this.slot(function(sections) {
          // if ( ! data ) return; 
          var grid = self.Grid.create()
            .forEach(sections, function(s) {
              var gUnit = self.GUnit.create({ columns: s.gridColumns })
                .addClass(self.myClass('card-container'));
              // TODO: figure out why importing controllerMode breaks
              var slot = s.createIsAvailableFor(self.data$, self.__subContext__.controllerMode$).map(function(isAvailable) {
                // NOTE: If we just return undefined here, then Element.slotE_
                // will put a self.E('SPAN') here. That span will be a child of
                // the Grid, which means the grid gap will apply to it, which
                // means that hidden sections will produce undesirable
                // whitespace that ruins the layout. Therefore we explicitly
                // return a dummy element here and set display: none so that the
                // grid doesn't add whitespace around it.
                if ( ! isAvailable ) return self.E().style({ display: 'none' });

                // Support string titles and functions
                var title$ = foam.Function.isInstance(s.title) ?
                foam.lang.ExpressionSlot.create({
                  obj$: self.data$,
                  code: s.title
                }) :
                s.title$;

                return self.E()
                  .start()
                    .addClass('h600')
                    .add(title$)
                    .show(title$.and(self.showTitle$))
                  .end()
                  .start(self.borders[s.name] || self.CardBorder)
                    .tag(s.view, {
                      data$: self.data$,
                      of$: self.of$,
                      section: s,
                      showTitle: false
                    })
                  .end();
              });
            
              gUnit.add(slot);
              this.add(gUnit);

              // NOTE: We need to trigger `resizeChildren` manually because when
              // the slot changes and the view updates, it doesn't trigger the
              // `onAddChildren` listener on Grid, which is what normally
              // triggers `resizeChildren`, which is what sets the grid-related
              // CSS properties. If resizeChildren doesn't fire, then any
              // sections that updated when the slot changed won't have the grid
              // CSS applied to them, so the layout will be broken.
              this.onDetach(slot.sub(this.framed(function() { grid.resizeChildren(); })));
            });

          return grid;
        }));
    }
  ]
});
