/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'IconChoiceView',
  extends: 'foam.u2.view.ChoiceView',

  documentation: `
    A choice view that outputs user-specified icons
  `,

  css: `
    ^item {
      display: flex;
    }

    ^ input[type="radio"] {
      display: none;
    }

    ^ {
      display: flex;
      background-color: $backgroundBrandTertiary;
      border-radius: 4px;
      display: flex;
      gap: 12px 24px;
      padding: 8px 12px;
      overflow-x: auto;
      white-space: nowrap;
    }

    ^label {
      cursor: pointer;
      line-height: 48px;
      align-items: center;
      background: none;
      border-radius: 4px;
      color: $textBrand;

      display: flex;
      justify-content: center;
      padding: 7px 12px;
    }

    ^label svg path {
      fill: currenyColor;
    }

    ^label:hover {
      background: $backgroundBrand;
      color: $textOnBrand;
      cursor: pointer;
    }

    ^label:hover svg path{
      fill: currentColor;
    }

    ^label^disabled-icon {
      background: $backgroundBrand;
      color: $textOnBrand;
      fill: currentColor;
      font-weight: $font-medium;
    }

    ^label^disabled-icon svg path {
      fill: currentColor;
    }
  `,

  methods: [
    function render() {
      // If no item is selected, and data has not been provided, select the 0th
      // entry.
      this
        .addClass(this.myClass())

      if ( ! this.data && ! this.index ) {
        this.index = 0;
      }

      if ( this.dao ) this.onDAOUpdate();
      this.choices$.sub(this.onChoicesUpdate);
      this.onChoicesUpdate();
    }
  ],

  listeners: [
    function onChoicesUpdate() {
      var self = this;

      this.removeAllChildren();

      this.choices.forEach(c => {
        var id = c.$UID;
        self.start().
          addClass(self.myClass('item')).
          start('input', {id: id}).
            attrs({
              type: 'radio',
              name: id,
              checked: self.slot(function(data) { return data === c[0]; })
            }).
            on('change', function(evt) {
              self.data = c[0];
            }).
          end().
          start('label', { tooltip: c[2] }).
            addClass(self.myClass('label')).
            // this should be called selected
            enableClass(self.myClass('disabled-icon'), self.slot(function(data) { return data === c[0] })).
            attrs({for: id}).
            tag({
              class: 'foam.u2.tag.Image',
              data: c[1],
              embedSVG: true
            }).
          end().
        end();
      });
    }
  ]
});
