/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.u2.property',
  name: 'MDCheckBox',
  extends: 'foam.u2.property.AbstractCheckBox',

  css: `
    ^ {
      -webkit-appearance: none;
      border: solid 2px $borderStrong;
      float: right;
      width: 3rem;
      height: 3rem;
      transition: background-color 140ms, border-color 140ms;
    }
    ^:checked {
      background-color: $backgroundInverse;
    }
    ^ .label {
      font-size: larger;
      font-weight: $font-regular;
      color: $red300;
    }
 `,

   methods: [
    function render() {
      this.SUPER();
        this.setAttribute('type', 'checkbox');
        this.addClass()
          .on('click', function() {
             if ( this.getAttribute('disabled') ) return;
             this.data = ! this.data;
           }.bind(this));

        this.start()
          .addClass('label')
          .add(this.label)
        .end();
    },

    function fromProperty(p) {
      this.SUPER(p);

      this.label = p.label;
    }
  ]
});
