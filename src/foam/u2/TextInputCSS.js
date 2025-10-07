/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'TextInputCSS',

  documentation: `
    A CSS axiom for text-based inputs such as normal text inputs, date & time
    inputs, selects, and number inputs. We didn't put this directly on
    foam.u2.Input because other inputs that extend that model such as checkbox
    and radio inputs aren't text-based and therefore the styles don't make sense
    for them.
  `,

  constants: {
    CSS: foam.u2.CSS.create({
      code: `
      .foam-u2-TextInputCSS {
        box-sizing: border-box;
        min-width: 64px;
        padding-left: $inputHorizontalPadding;
        padding-right: $inputHorizontalPadding;
        border: 1px solid;
        border-radius: $inputBorderRadius;
        color: $textDefault;
        background-color:$backgroundDefault;
        border-color: $borderDefault;
        width: 100%;
      }

      .foam-u2-TextInputCSS:hover {
        border-color: $borderStrong;
      }

      .foam-u2-TextInputCSS:hover::placeholder,
      .foam-u2-TextInputCSS:hover:-ms-input-placeholder,
      .foam-u2-TextInputCSS:hover::-ms-input-placeholder {
        color: $textTertiary;
      }

      .foam-u2-TextInputCSS:focus-visible {
        outline: none;
        border: 1px solid $borderBrand;
      }

      .foam-u2-TextInputCSS:disabled {
        color: $textSecondary;
        background-color: $backgroundTertiary;
        border-color: $borderDefault;
      }

      .foam-u2-TextInputCSS.error {
        color: $textDestructive;
        background-color: $backgroundDestructiveTertiary;
        border-color: $destructive400;
      }

      @media (prefers-color-scheme: dark) {
        .allowVariants input {
          color-scheme: dark;
        }
      }
      `,
      name: 'CSS-TextInputCSS',
      expands_: false
    })
  },

  methods: [
    function init() {
      this.SUPER();
      this.CSS.maybeInstallInDocument(this.__context__, {id: 'foam.u2.TextInputCSS'});
      this.addClass('foam-u2-TextInputCSS');
      this.enableClass('allowVariants', this.__context__.theme$.dot('allowVariants'));
    }
  ]
});
