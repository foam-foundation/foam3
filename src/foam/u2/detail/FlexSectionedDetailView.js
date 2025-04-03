/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.detail',
  name: 'FlexSectionedDetailView',
  extends: 'foam.u2.detail.AbstractSectionedDetailView',

  requires: [
    'foam.u2.borders.NullBorder',
    'foam.u2.detail.SectionView',
    'foam.u2.layout.GUnit',
    'foam.u2.layout.Grid'
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
    }
    ^slotElement {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      justify-content: center;
      gap: 40pt;
    }
  `,

  properties: [
    {
      class: 'foam.u2.ViewSpec',
      name: 'border',
      factory: function() {
        return this.NullBorder;
      }
    },
    {
      class: 'Boolean',
      name: 'showTitle'
    }
  ],

  methods: [
    function render() {
      var self = this;

      this.SUPER();
      this
        .addClass(this.myClass())
        .add(this.slot(function(sections) {
          return self.E()
            .addClass(this.myClass('slotElement'))
            .forEach(sections, function (section) {
              const isAvailable$ = section.createIsAvailableFor(self.data$, self.__subContext__.controllerMode$);
              this.add(isAvailable$.map(function(isAvailable) {
                if ( ! isAvailable ) return self.E().style({ display: 'none' });

                return self.border.create()
                  .tag(section.view, {
                    data$: self.data$,
                    of$: self.of$,
                    showTitle: self.showTitle,
                    section
                  });
              }));
            });
        }));
    }
  ]
});

