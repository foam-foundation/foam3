/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.detail',
  name: 'VerticalDetailView',
  extends: 'foam.u2.detail.AbstractSectionedDetailView',

  requires: [
    'foam.u2.detail.SectionView',
    'foam.u2.layout.Rows'
  ],

  css:`
    ^centered {
      align-self: center;
    }
  `,

  properties: [
    {
      name: 'config'
      // Map of property-name: {map of property overrides} for configuring properties
      // values include 'label', 'units', and 'view'
    },
    {
      class: 'Boolean',
      name: 'showTitle',
      value: true
    },
    {
      class: 'Boolean',
      name: 'centered',
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();
      this
        .addClass(this.myClass())
        .add(this.slot(function(of, sections) {
          return self.E()
            .start(self.Rows)
              .forEach(sections, function(s) {
                var slot = s.createIsAvailableFor(self.data$, self.__subContext__.controllerMode$).map(function(isAvailable) {
                  if ( ! isAvailable ) return self.E().style({ display: 'none' });
                  return self.E().enableClass(self.myClass('centered'), self.centered$).start(s.view, {
                    data$: self.data$,
                    of$: self.of$,
                    section: s,
                    config: self.config,
                    showTitle: self.showTitle
                  })
                  .end();
                })
                this.add(slot);
              })
            .end();
        }));
    }
  ]
});
