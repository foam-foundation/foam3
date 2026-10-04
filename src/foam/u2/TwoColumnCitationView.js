/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'TwoColumnCitationView',
  extends: 'foam.u2.View',

  documentation: '2x2 column citation view',

  css: `
    << {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 0.8rem 0.2rem;
      border-bottom: 0.05rem solid $borderDefault;
      gap: 0.64rem;
      color: $grey500;
    }
    <<row-1{
      display: flex;
      justify-content: space-between;
      padding: 0.2rem;
    }
    <<row-2{
      display: flex;
      justify-content: space-between;
      padding: 0.2rem;
    }
    <<row-1-section-2{
      display: flex;
      gap: 0.5rem;
    }
    <<primary{
      color: $textBrandSecondary;
    }
  `,

  methods: [
    function render() {
      this
        .addClass('p-legal-light', this.myClass())
        .start().addClass(this.myClass('row-1'))
          .start().addClass(this.myClass('row-1-section-1'))
            .start().addClass(this.myClass('primary')).add("field 1").end()
          .end()
          .start().addClass(this.myClass('row-1-section-2'))
            .add("field 2")
          .end()
        .end()
        .start().addClass('p-xs', this.myClass('row-2'))
          .start().addClass(this.myClass('row-2-section-1'))
            .add("field 3")
          .end()
          .start().addClass(this.myClass('row-2-section-2'))
            .add("field 4")
          .end()
        .end();
    }
  ]
});
