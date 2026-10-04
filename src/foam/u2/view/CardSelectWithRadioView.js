/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.u2.view',
  name: 'CardSelectWithRadioView',
  extends: 'foam.u2.view.CardSelectView',

  documentation: `
    An extension of the CardSelectView which includes a radiobutton on the left
  `,

  requires: [ 'foam.u2.view.RadioButton' ],

  css: `
    <<radio-choice-flexbox {
      display: flex;
    }
    << .radio {
      margin-right: 1em;
    }
  `,

  methods: [
    function render() {
      this
      .addClass(this.myClass())
      .addClass(this.myClass('innerFlexer'))
      .start(this.CardBorder)
        .addClass(this.myClass('base'))
        .enableClass(this.myClass('large-card'), this.largeCard$)
        .enableClass(this.myClass('selected'), this.isSelected$)
        .enableClass(this.myClass('disabled'), this.isDisabled$)
        .enableClass(this.myClass('selected-disabled'), this.slot((isSelected, isDisabled) => {
          return isSelected  && isDisabled;
        }))
        .start()
          .addClass(this.myClass('radio-choice-flexbox'))
          .add(this.RadioButton.create({
            isSelected$: this.isSelected$,
            isDisabled$: this.isDisabled$
          }, this))
          .call(this.addContent, [this])
        .end()
      .end()
      .on('click', this.onClick);
    },
    function addContent(self) {
      this.add(self.label$);
    }
  ]
});
