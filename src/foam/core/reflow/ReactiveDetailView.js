/**
 * @license
 * Copyright 2016 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FObjectReactiveDetailViewRefinement',
  refines: 'FObject',

  properties: [
    {
      class: 'Map',
      generateJava: false,
      name: 'reactions_',
      searchable: false,
      hidden: true,
      shortName: 'r_',
      transient: true,
      factory: function() { return {}; },
      postSet: function(_, rs) {
        // Only start reactions if in the proper context
        if ( this.__context__.scope ) {
          for ( var key in rs ) {
            this.startReaction_(key, rs[key]);
          }
        }
        return rs;
      },
      toJSON: function(v) {
        var m = {};
        for ( key in v ) { m[key] = v[key].toString(); }

        return m;
      }
    }
  ],

  methods: [
    function addReaction(name, formula) {
      // TODO: stop any previous reaction
      this.reactions_[name] = formula;
      this.startReaction_(name, formula);
    },
    function startReaction_(name, formula) {
      // HACK: delay starting reaction in case we're loading a file
      // and dependent variables haven't loaded yet.
      window.setTimeout(function() {
        var self = this;
        var f;

        with ( this.__context__.scope ) {
          f = eval('(function() { return ' + formula + '})');
        }
        f.toString = function() { return formula; };

        var detached = false;
        self.onDetach(function() { detached = true; });
        var timer = function() {
          if ( detached ) return;
          if ( self.reactions_[name] !== f ) return;
          self[name] = f.call(self);
          self.__context__.requestAnimationFrame(timer);
        };

        this.reactions_[name] = f;
        timer();
      }.bind(this), 10);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyBorder',
  extends: 'foam.u2.PropertyBorder',

  imports: [ 'scope' ],

  css: `
    ^{
      flex-direction: row;
      align-items: center;
      width: 100%;
    }
    ^ ^label {
      width: 50%;
    }
    ^view: {
      min-height: 0px;
    }
    ^view > div > span {
      align-items: center;
      gap: 5px;
    }
    ^select, ^select1, ^select2 {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      padding: 10px;
      background-color: $grey100;
      border-radius: 5px;
      border: 1px solid $grey200;
    }
    ^switch { color: #ccc; width: 12px !important; }
    ^switch.reactive {
      font-weight: 600;
      color: $primary500!important;
    }
    ^formulaInput input:focus {
      outline: 1px solid $primary500 !important;
    }
    ^element-icon {
      width: 14px;
      height: 14px;
    }
    ^ .foam-core-reflow-SinkView {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 5px;
    }
    ^ .foam-core-reflow-SinkView > div > div {
      width: 100%;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'reactive',
      postSet: function(_, r) {
        if ( ! r && this.data ) {
          delete this.data.reactions_[this.prop.name];
        }
      }
    },
    {
      class: 'String',
      name: 'formula',
      displayWidth: 50,
      factory: function() {
        return this.data && this.data.reactions_[this.prop.name];
      },
      postSet: function(_, f) {
        if ( f ) this.setFormula(f);
      }
    }
  ],

  methods: [
    function render() {
      this.data$.sub(this.onDataChange);
      this.onDataChange();

      this.SUPER();
    },

    function layoutView(self, prop, viewSlot) {
      this.start().
        addClass(self.myClass('switch')).
        enableClass('reactive', self.reactive$).
        on('click', self.toggleMode).
        add(self.dynamic(function(reactive) {
          if ( reactive ) {
            this.start(foam.u2.tag.Image, {
              glyph: 'functionSign',
              embedSVG: true
            }).addClass(self.myClass('element-icon')).end()
          } else {
            this.start(foam.u2.tag.Image, {
              glyph: 'equalSign',
              embedSVG: true
            }).addClass(self.myClass('element-icon')).end()
          }
        })).
      end();

      this.add(
        self.dynamic(function(reactive) {
          if ( reactive ) {
            this.start().
              start(self.FORMULA, {data$: self.formula$}).
                addClass(self.myClass('formulaInput')).
                on('blur', function() { self.reactive = !! self.formula; }).
                focus().
              end().add(self.data.slot(self.prop.name)).
            end();
          } else {
            this.add(viewSlot);
          }
        })
      );
    },

    function setFormula(formula) {
      this.data.startReaction_(this.prop.name, formula);
    }
  ],

  listeners: [
    function toggleMode() {
      this.reactive = ! this.reactive;
    },

    function onDataChange() {
      if ( this.data ) {
        var f = this.data.reactions_[this.prop.name];
        this.formula  = f ? f.toString() : '';
        this.reactive = !! f;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ReactiveDetailView',
  extends: 'foam.u2.DetailView',

  requires: [ 'foam.core.reflow.PropertyBorder' ],

  css: `
   // ^ { margin: inherit !important; }
   // ^ table { width: auto !important; }
   ^title input { font-size: large; }
   ^title { font-size: large; }
   ^collapsePropertyViews .com-google-flow-PropertyBorder-propHolder { width: auto; display: inline-flex; }
   ^ .foam.core.reflow-PropertyBorder-propHolder > :first-child { width: auto; }
  `,

  properties: [
    [ 'showActions', true ],
    [ 'expandPropertyViews', false ],
  ],

  methods: [
    function renderTitle(self) {
      // NOP
    }
  ]
});

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ReactiveSectionedDetailView',
  extends: 'foam.u2.detail.SectionedDetailView',

  requires: [
    'foam.core.reflow.ReactiveSectionView'
  ],

  css: `
    ^card-container {
      padding: 20px;
      border-top: 1px solid $grey200;
    }
  `,

  properties: [
    [ 'showActions', true ],
    [ 'expandPropertyViews', false ]
  ],

  methods: [
    function render() {
      this.sections.forEach(s => s.view = 'foam.core.reflow.ReactiveSectionView');
      this.SUPER();
    },
    function renderTitle(self) {
      // NOP
    }
  ]
});
