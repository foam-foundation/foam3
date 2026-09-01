/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'TabChoiceView',
  extends: 'foam.u2.view.ChoiceView',
  mixins: ['foam.u2.memento.Memorable'],

  documentation: `
    A choice view that outputs user-specified tabs
  `,

  css: `
    ^ {
      display: flex;
    }

    ^item {
      display: flex;
    }

    ^ input[type="radio"] {
      display: none;
    }

    ^ label:has(input[type=radio]:checked) {
      border-bottom: solid 3px $borderBrand;
      font-weight: bold;
      color: $textBrand;
    }

    ^ label {
      cursor: pointer;
      padding: 8px 24px;
    }
  `,

  properties: [
    {
      name: 'choice',
      factory: function() { return this.choices[0]; },
    },
    {
      name: 'cannedQuery',
      shortName: 'query',
      memorable: true,
      factory: function() { return this.choice[1]; }
    }
  ],

  methods: [
    function render() {
      this.addClass();

      // If no item is selected, and data has not been provided, select the 0th
      // entry.
      if ( ! this.data && ! this.index ) {
        this.index = 0;
      }

      var self = this;

      this.add(this.dynamic(function(choices) {
        choices.forEach((c) => {
          if ( self.cannedQuery == c[1] )
            self.data = c[0];

          this
            .start("div")
            .addClass(self.myClass("item"))
            .start('label')
            .start('input')
            .attrs({
              type: 'radio',
              checked: self.slot(function (data) {
                return data === c[0];
              })
            })
            .on('change', function () {
              self.data = c[0];
              self.cannedQuery = c[1];
            })
            .end()
            .addClass('p')
            .start('span')
            .translate(c[1], c[1])
            .end()
            .end();
        });
      }));

      if ( this.dao ) this.onDAOUpdate();
    }
  ]
});
