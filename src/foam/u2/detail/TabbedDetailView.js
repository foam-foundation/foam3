/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.detail',
  name: 'TabbedDetailView',
  extends: 'foam.u2.detail.AbstractSectionedDetailView',

  requires: [
    'foam.lang.ArraySlot',
    'foam.u2.borders.CardBorder',
    'foam.u2.detail.SectionView',
    'foam.u2.Tab',
    'foam.u2.Tabs'
  ],

  css: `
    ^ .foam-u2-Tabs-content > div {
      background: $backgroundDefault;
      padding: 14px 16px;
      border-bottom-left-radius: 6px;
      border-bottom-right-radius: 6px;
    }

    ^ .foam-u2-table-TableView table {
      width: 100%;
    }

    ^ .foam-u2-Tabs-tabRow {
      border-top-left-radius: 6px;
      border-top-right-radius: 6px;
      position: sticky;
      top: 0;
    }
    ^tab-wrapper.foam-u2-borders-CardBorder {
      padding: 0;
    }
    ^wrapper {
      padding: 14px 24px;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'defaultSectionLabel',
      value: 'Uncategorized'
    },
    'tabs',
    {
      name: 'visibilityArray_',
      class: 'Array'
    },
    {
      name: 'stableVisibilities_',
      class: 'Array'
    }
  ],

  methods: [
    function render() {
      var self = this;

      this.SUPER();
      this
        .addClass(this.myClass())
        .add(this.slot(function(sections) {
          self.visibilityArray_$.follow(self.ArraySlot.create({
            slots: sections.map((s) => s.createIsAvailableFor(self.data$, self.__subContext__.controllerMode$))
          }));
          this.onDetach(self.visibilityArray_$.sub(self.updateVis));
          self.updateVis();

          return self.E()
            .add(self.stableVisibilities_$.map(visibilities => {
              var availableSections = visibilities.length == sections.length ? sections.filter((s, i) => s.title && visibilities[i]) : sections;
              var availableSectionsWithoutTitle = visibilities.length == sections.length ? sections.filter((s, i) => !s.title && visibilities[i]) : sections;

              // Check available sections with a title
              if ( ( ! availableSections || availableSections.length == 0 ) && availableSectionsWithoutTitle && availableSectionsWithoutTitle.length > 0 ) {
                availableSections = availableSectionsWithoutTitle;
              } else {
                console.warn('No visible sections in tabbed view for entity: ', self.of ? self.of.id : 'unknown');
              }

              var e = availableSections.length == 1 ?
                this.E().start(self.CardBorder).addClass(self.myClass('wrapper'))
                  .tag(availableSections[0].view, { data$: self.data$, section: availableSections[0], showTitle: false })
                .end() :
                this.E().start(self.CardBorder).addClass(self.myClass('tab-wrapper'))
                .start(self.Tabs, {}, self.tabs$)
                  .forEach(availableSections, function(s) {
                    if ( s.title ) {
                      var title$ = foam.Function.isInstance(s.title) ?
                        foam.lang.ExpressionSlot.create({
                          obj: self.data,
                          code: s.title
                        }) :
                        s.title$;

                      var tab = foam.lang.SimpleSlot.create({}, self);
                      this
                        .start(self.Tab, { label$: title$ || self.defaultSectionLabel }, tab)
                            .tag(s.view, {
                              data$: self.data$,
                              of$: self.of$,
                              section: s,
                              showTitle: false,
                              selected$: tab.value.selected$
                            })
                       .end();
                    }
                  })
                .end().end();
              return e;
            }));
        }));
    }
  ],
  listeners: [
    {
      name: 'updateVis',
      isMerged: true,
      delay: 100,
      code: function() {
        if ( ! foam.util.equals(this.stableVisibilities_, this.visibilityArray_) ) {
          this.stableVisibilities_ = this.visibilityArray_;
        }
      }
    }
  ]
});
