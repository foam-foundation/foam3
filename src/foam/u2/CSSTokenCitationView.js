/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'CSSTokenCitationView',
  extends: 'foam.u2.CitationView',

  css:`
    ^row {
      display: flex;
      gap: 4px;
      align-items: center;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'showName',
      value: true
    }
  ],

  methods: [
    function render() {
      this
        .addClass('p', this.myClass('row'))
        .callIf(this.showName, function() {
          this.add(this.data.name$).add(' : ');
        })
        .call(this.addTokenValue, [this.data.value$]);
    },
    {
      name: 'addTokenValue',
      code: function(valueSlot) {
        this.add(valueSlot.map(v => foam.CSS.returnTokenValue(v, this.cls_, this.__subContext__)));
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'ColorTokenCitationView',
  extends: 'foam.u2.CSSTokenCitationView',

  css:`
    ^colorBox {
      width: 1em;
      height: 1em;
      border-radius: 50%;
      border: 1px solid $borderLight;
    }
  `,

  methods: [
    {
      name: 'addTokenValue',
      code: function(valueSlot) {
        let color$ = valueSlot.map(v => foam.CSS.returnTokenValue(v, this.cls_, this.__subContext__));
        this.start()
          .addClass(this.myClass('colorBox'))
          .style({
            'background-color': color$
          })
        .end()
        .add(color$);
      }
    }
  ]

});