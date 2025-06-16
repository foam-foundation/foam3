/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ReactiveSectionView',
  extends: 'foam.u2.detail.SectionView',

  requires: [ 'foam.core.reflow.PropertyBorder' ],

  methods: [
    function render() {
      var self = this;

      self
        .addClass(self.myClass())
        .callIf(self.section, function() {
          self.addClass(self.myClass(self.section.name))
        })
        .add(self.slot(function(section, showTitle, section$title, section$subTitle, shown) {
          if ( ! section || ! shown ) return;
          return self.Rows.create()
            .callIf(showTitle && section$title, function() {
              this.start().add(section.title.toUpperCase()).addClass('h600', self.myClass('section-title')).end();
            })
            .callIf(section$subTitle, function() {
              this.start().addClass('p', 'subtitle').add(section.subTitle).end();
            })
            .add(this.slot(function(loadLatch) {
              var view = this.E().start(self.Grid, {}).addClass(self.myClass('grid'));
              let propVisArray = [];
              if ( loadLatch ) {
                view.forEach(section.properties, function(p, index) {
                  var config = self.config && self.config[p.name];
                  if ( config ) {
                    p = p.clone();
                    for ( var key in config ) {
                      if ( config.hasOwnProperty(key) ) {
                        p[key] = config[key];
                      }
                    }
                  }
                  var shown$ = p.createVisibilityFor(self.data$, self.controllerMode$).map(mode => mode != self.DisplayMode.HIDDEN);
                  this.start(self.GUnit, { columns$: p.gridColumns$, rwColumns$: p.rwGridColumns$, prop: p })
                    .show(shown$)
                    .add(shown$.map(shown => {
                      
                      return shown ? self.PropertyBorder.create({ prop: p }) : self.E();
                    }))
                  .end();
                  propVisArray.push(shown$);
                });
                let propVisArray$ = foam.lang.ArraySlot.create({ slots: propVisArray }, this);
                this.onDetach(propVisArray$.framed().sub(this.framed(function() { view.resizeChildren(); })));
              }
              return view;
            }))
            .start(self.Cols)
              .addClass(self.myClass('actionDiv'))
              .style({
                'margin-top': section.actions.length ? '16px' : 'initial'
              })
              .forEach(section.actions, function(a) {
                this.add(a);
              })
            .end();
        }));
    }
  ]
});