/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.qa',
  name: 'QAAnsweredView',
  extends: 'foam.u2.View',

  documentation: `
    Standalone read-only list of all answered questions for a foam.QA2() instance.
    Receives only the QA data object.
  `,

  css: `
    ^ {
      overflow-y: auto;
    }
  `,

  methods: [
    function render() {
      var self = this;
      this.SUPER();
      this.addClass(this.myClass());
      this.add(this.dynamic(function(data$answeredOrder) {
        if ( ! data$answeredOrder || ! data$answeredOrder.length ) return null;
        this
          .startContext({ controllerMode: foam.u2.ControllerMode.VIEW })
            .tag({
              class: 'foam.u2.detail.VerticalDetailView',
              data$: self.data$,
              propertyWhitelist: data$answeredOrder
            })
          .endContext();
      }))
    }
  ]
});
