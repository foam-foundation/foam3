/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'OptionalCSSTokenView',
  extends: 'foam.u2.View',
  documentation: `A view to be used with CSSTokenProperties, allows freeform text or suggests tokens. 
  When using tokens, displays the resultant token value in the current context`,

  requires: [
    'foam.u2.CSSTokenSuggestedTextField',
    'foam.u2.ToggleActionView'
  ],
  properties: [
    {
      name: 'prop'
    },
    {
      class: 'Boolean',
      name: 'tokenMode',
      preSet: function(o,n) {
        if ( ! n && this.data?.startsWith('$') ) {
          this.data = foam.CSS.returnTokenValue(this.data, this.cls_, this.__subContext__);
        }
        return n;
      }
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'viewView',
      value: {
        class: 'foam.u2.TextField'
      }
    },
    {
      class: 'String',
      name: 'data',
      postSet: function(o,n) {
        if ( ! o && n?.startsWith('$') && ! this.tokenMode ) {
          this.tokenMode = true;
        }
      }
    },
    'view_'
  ],

  css: `
    ^ {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    ^inputContainer {
      flex-grow: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ^inputContainer > :first-child {
      flex-grow: 1;
    }
    ^ > :last-child {
      height: $inputHeight;
    }
  `,
  methods: [
    function fromProperty(p) {
      this.SUPER(p);
      this.prop = p;
    },
    function render() {
      this.SUPER();
      let self = this;
      this
        .addClass()
        .add(this.dynamic(function(tokenMode) {
          let spec = self.viewView;
          if ( tokenMode ) spec = self.CSSTokenSuggestedTextField;
          this
          .start()
            .addClass(self.myClass('inputContainer'))
            .start(spec, { data$: self.data$ }, self.view_$)
              .call(function() {
                self.prop && this.fromProperty?.(self.prop);
              })
            .end()
            .callIf(tokenMode, function() {
              this.add(self.view_?.dynamic(function(tokenObject) {
                if ( ! tokenObject ) return;
                this.startContext({ controllerMode: foam.u2.ControllerMode.VIEW })
                  .tag(foam.u2.CitationView, { data: tokenObject, showName: false })
                .endContext();
              }));
            })
          .end()
        }))
        .startContext({ data: this })
          .tag(this.ToggleActionView, {
            action: this.TOGGLE_MODE,
            buttonStyle: 'TEXT',
            size: 'SMALL',
            tooltip$: self.tokenMode$.map(v => v ? 'Use Value' : 'Use Token'),
            themeIcon$: self.tokenMode$.map(v => v ? 'unlink' : 'link'),
            actionState$: self.tokenMode$
          })
        .endContext()
    }
  ],
  actions: [
    {
      name: 'toggleMode',
      label: '',
      code: function() {
        this.tokenMode = ! this.tokenMode;
      }
    }
  ]
})
