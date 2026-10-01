/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'FSMProxyDetailView',
  extends: 'foam.u2.detail.AbstractSectionedDetailView',

  exports: ['FSMProp.of as FSMClass'],

  requires: ['foam.lang.StateTransition'],

  classes: [
    {
      name: 'StateTransitionCitationView',
      extends: 'foam.u2.View',
      imports: ['FSMClass'],
      css: `
        ^sub {
          font: monospace;
        }
        ^lifecycle-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
      `,
      methods: [
        function render() {
          let self = this;
          let data$ = this.data$;
          this
            .addClass(this.myClass('lifecycle-content'))
            .start().addClass('h600').add(data$.map(function(t) {
              if ( ! t || ! t.to ) return 'Stage';
              let label = self.FSMClass?.[t.to]?.label || t.to;
              // Same-state entry (an event recorded without a lifecycle
              // transition, e.g. an acquirer Dispute Response): show its note or
              // payload summary instead of repeating the current state label.
              if ( t.from === t.to ) {
                return t.note || ( t.payload && t.payload.toSummary && t.payload.toSummary() ) || label;
              }
              return label;
            })).end()
            .start().addClass('p-legal', this.myClass('sub')).add(data$.dot('timestamp').map(v => v && v.toLocaleString(navigator.language))).end();
        }
      ]
    }
  ],

  css: `
    ^wrapper {
      --circle-size: 1.4rem;
      overflow: hidden;
      height: 100%;
      display: flex;
      flex-direction: row;
      gap: 20px;
    }
    ^lifecycle-section, ^section, ^innerSection {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    ^lifecycle-section {
      flex: 1;
      padding: 20px;
      background: $backgroundSecondary;
      border-radius: 8px;
      overflow-y: auto;
    }
    ^lifecycle-item {
      display: flex;
      align-items: flex-start;
      background: $backgroundDefault;
      border: 1px solid $borderLight;
      position: relative;
      cursor: pointer;
      padding: 10px;
      border-radius: 6px;
      transition: background-color 0.2s ease;
    }
    ^lifecycle-item:hover {
      background-color: $backgroundHover;
      border: 1px solid $borderBrand;
    }
    ^lifecycle-item.active {
      background-color: $backgroundBrandTertiary;
      border: 1px solid $borderBrandStrong;
    }
    ^section-heading {
      color: $textTertiary;
      font-weight: $font-bold;
    }
    ^status-wrapper {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    ^status-wrapper > ^lifecycle-item {
      flex: 1;
    }
    ^status-wrapper:last-child > ^circle {
      background: $backgroundBrandTertiary;
      border: 2px solid $backgroundBrand;
    }
    ^section:not(:first-child) {
      border-top: 1px solid $borderDefault;
      padding-top: 1rem;
    }
    ^details-section {
      flex: 4;
      background: $backgroundDefault;
      border-radius: 4px;
      overflow: auto;
    }
    ^circle {
      height: var(--circle-size);
      background: $backgroundBrand;
      aspect-ratio: 1;
      border-radius: 100%;
      z-index: 1;
    }
    ^innerSection {
      position: relative;
    }
    ^innerSection::before {
      content: '';
      position: absolute;
      left: calc(var(--circle-size)/2 - 1px);
      top: var(--line-top, 30px);
      bottom: var(--line-bottom, 30px);
      width: 2px;
      background: $backgroundBrand;
      z-index: 0;
    }
  `,

  messages: [
    { name: 'TITLE_FSM_PROP', messageMap: { en: 'CURRENT ${fsmProp}', fr: '${fsmProp} ACTUELLE' }, template: true },
    { name: 'TITLE_TIMELINE', messageMap: { en: 'TIMELINE', fr: 'CHRONOLOGIE' } },
    { name: 'TITLE_DETAILS', messageMap: { en: 'DETAILS', fr: 'DÉTAILS' } }
  ],

  properties: [
    {
      name: 'data',
      postSet: function(o, n) {
        if ( ! o && ! this.selectedData_ ) this.selectedData_ = -1;
        this.generateStateTransitions();
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Property',
      name: 'FSMProp',
      documentation: 'Axiom for which state transitions should be used to generate the view',
      adapt: function(o, n) {
        // Adapt strings to props
        return n;
      }
    },
    // Could be a stateTransition or a model's data (-1 = show main data, >= 0 = show timeline transition)
    {
      name: 'selectedData_',
      value: -1
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'viewView',
      value: { class: 'foam.u2.detail.TabbedDetailView' }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'transitionView',
      value: { class: 'foam.u2.detail.SectionedDetailView' }
    },
    {
      class: 'FObjectArray',
      of: 'foam.lang.FObject',
      name: 'transitions'
    }
  ],

  methods: [
    function generateStateTransitions() {
      if ( ! this.FSMProp || ! this.data ) return;
      this.transitions$.follow(this.data[this.FSMProp?.name+'History$']);
    },
    function startTab(data, e, idx) {
      return e.start()
        .addClass(this.myClass('lifecycle-item'))
        .enableClass('active', this.selectedData_$.map(s => s === idx))
        // Turn this into a button for accessibility
        .on('click', () => this.selectedData_ = idx);
    },  
    function render() {
      let self = this;
      this.generateStateTransitions();
      // FSMProp may arrive after first render when the parent DetailView
      // binds it via a slot (concrete subclass only known after data loads).
      // Defer the FSMProp-touching block via a dynamic so it (re)renders
      // once FSMProp is populated -- direct access here would crash on the
      // first run with FSMProp=null.
      this.onDetach(this.FSMProp$.sub(this.generateStateTransitions.bind(this)));
      this
      .start()
        .addClass(self.myClass('wrapper'))
      // Left
      .start()
        .addClass(self.myClass('lifecycle-section'))
        .add(this.dynamic(function(FSMProp) {
          if ( ! FSMProp ) return;
          this
          .start()
            .addClass(self.myClass('section'))
            .start().addClass('p-legal', self.myClass('section-heading'))
            .add(self.TITLE_FSM_PROP({fsmProp: FSMProp.label.toUpperCase()}))
            .end()
            .startContext({ controllerMode: foam.u2.ControllerMode.VIEW })
            .start(FSMProp, { data$: self.data$.dot(FSMProp.name)})
            .end()
            .endContext()
          .end();
        }))
        .add(this.dynamic(function(transitions, data) {
          if ( data ) {
            this
            .start()
              .addClass(self.myClass('section'))
              .start().addClass('p-legal', self.myClass('section-heading')).add(self.TITLE_DETAILS).end()
              .call(function() {
                self.startTab(data, this, -1)
                  .start().addClass('h500').add(self.data$.map(v => v.cls_.model_.label)).end()
                .end();
              })
            .end();
          }
          this
          .start()
            .addClass(self.myClass('section'))
            .start().addClass('p-legal', self.myClass('section-heading')).add(self.TITLE_TIMELINE).end()
            .start().addClass(self.myClass('innerSection'))
              .forEach(transitions, function(v, idx) {
                this.start()
                .addClass(self.myClass('status-wrapper'))
                .call(function() {
                  let el = self.element_.querySelector('.' + self.myClass('wrapper'));
                  if ( idx == 0 ) {
                    this.resizeObserver(function(entries) {
                      el.style.setProperty('--line-top', entries[0].borderBoxSize[0].blockSize/2);
                    })
                  } else if ( idx == transitions.length - 1 ) {
                    this.resizeObserver(function(entries) {
                       el.style.setProperty('--line-bottom', entries[0].borderBoxSize[0].blockSize/2);
                    })
                  }
                })
                .start().addClass(self.myClass('circle')).end()
                .call(function() {
                  self.startTab(v, this, idx)
                    .tag(self.StateTransitionCitationView, { data: v })
                  .end();
                })
                .end();
              })
            .end()
          .end()
        }))
      .end()

      // Right Side: Details
      .start()
        .addClass(self.myClass('details-section'))
        .add(this.dynamic(function(selectedData_, data) {
          if ( ! data ) return;
          let view = self.viewView;
          let data$ = self.data$
          if ( selectedData_ >= 0 ) {
            data$ = self.transitions$.at(selectedData_);
            view = self.transitionView;
          }
          this.tag(view, { data$: data$, showTitle: true })
        }))
      .end()
    }
  ]
});
