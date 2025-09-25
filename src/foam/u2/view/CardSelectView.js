/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'CardSelectView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.borders.CardBorder'
  ],

  axioms: [
    foam.pattern.Faceted.create({
      inherit: true
    })
  ],

  topics: [
    'clicked',
    'selectionDisabled'
  ],

  css: `
    ^base {
      box-sizing: content-box;
      background-color: $backgroundDefault;
      border-radius: 5px;
      position: relative;
      padding: 16px;
      transition: all 0.2s linear;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
    ^ .foam-u2-borders-CardBorder {
      min-height: auto;
    }
    .foam-u2-borders-CardBorder^large-card {
      min-height: 2.5vh;
    }
    ^ .foam-u2-borders-CardBorder^selected {
      border-color: $borderBrand;
    }

    ^ .foam-u2-borders-CardBorder^disabled {
      background-color: $backgroundTertiary;
      color: $textTertiary;
    }

    ^ .foam-u2-borders-CardBorder^selected-disabled {
      border-color: $borderBrandXLight;
      background-color: $backgroundTertiary;
      color: $textTertiary;
    }
    .foam-u2-view-MultiChoiceView-flexer .foam-u2-layout-Cols {
      column-gap: 17px;
      flex-flow: nowrap;
    }
  `,

  documentation: `
    A selectable card which takes a boolean as data, has three states: disabled, selected and unselected
  `,

  properties: [
    {
      name: 'label',
      factory: function() {
        return (this.data?.toSummary && this.data?.toSummary()) ?? (this.data || '');
      }
    },
    {
      class: 'Boolean',
      name: 'isSelected'
    },
    {
      class: 'Boolean',
      name: 'isDisabled',
      postSet: function(_, n) {
        if ( n ) this.selectionDisabled.pub();
      }
    },
    'largeCard'
  ],

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
        .on('click', this.onClick)
        .add(this.label)
      .end();
    }
  ],

  listeners: [
    function onClick() {
      this.clicked.pub();
    }
  ]
});
