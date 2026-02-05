/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'FormattedTextField',
  extends: 'foam.u2.View',

  requires: ['foam.u2.TextField'],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      height: $inputHeight;
      justify-content: center;
      position: relative;
      width: 100%;
    }
    ^placeholder.foam-u2-TextField {
      bottom: 0;
      inline-size: fit-content;
      left: 0;
      opacity: 0.7;
      pointer-events: none;
      position: absolute;
      right: 0;
      top: 0;
      width: fit-content;
    }
    ^real-input.foam-u2-TextField {
      z-index: 1;
      background-color: transparent;
      bottom: 0;
      left: 0;
      position: absolute;
      right: 0;
      top: 0;
      width: fit-content;
    }
  `,

  constants: [
    {
      type: 'Array',
      name: 'BACKSPACE_OR_DELETE',
      value: [8 /*backspace*/, 46 /*delete*/]
    }
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.u2.TextFormatter',
      name: 'formatter',
      documentation: `
        An object of the TextFormatter interface which will be used to apply
        specific formatting logic to the input.
      `
    },
    // Use a new prop as input data in case the actual data shouldn't include formatting
    'formattedData',
    {
      name: 'placeholder',
      factory: function() {
        return this.formatter.getPlaceholder();
      }
    },
    {
      name: 'dynamicPlaceholder',
      expression: function(placeholder, formattedData, mode) {
        return mode === foam.u2.DisplayMode.RW ?
          this.formatter.getPlaceholder(formattedData, placeholder)
          : '';
      },
      documentation: 'The placeholder text when the input has content'
    },
    {
      class: 'Boolean',
      name: 'returnFormatted',
      documentation: 'Used to configure whether or not to return the data with formatting'
    },
    // booleans to configure state for formatting data
    'isDelete',
    'formatted'
  ],

  methods: [
    function render() {
      this.resetState();
      this.formattedData$.sub((detachable) => { this.formatData(detachable.src.oldValue); });
      this.formattedData = this.data || '';

      return this
        .addClass(this.myClass())
        .start(this.TextField, { onKey: true, data$: this.formattedData$, mode$: this.mode$ })
          .addClass(this.myClass('real-input'))
        .end()
        .start(this.TextField, { autocomplete: false, data$: this.dynamicPlaceholder$, mode$: this.mode$ })
          .addClass(this.myClass('placeholder'))
        .end()
        .on('paste', evt => {
          if ( ! evt.clipboardData.types.includes('text/plain') || ! evt.clipboardData.getData('text').trim() ) {
            evt.preventDefault();
            evt.stopPropagation();
          }
        })
        .on('keydown', evt => {
          if ( this.BACKSPACE_OR_DELETE.includes(evt.keyCode) ) this.setStateOnDelete(evt);
        });
    },

    function setStateOnDelete(evt) {
      this.isDelete = true;
      var start = evt.target.selectionStart;
      var end = evt.target.selectionEnd;
      // treat deleting single character as deleting a selectionrange of length 1
      if ( start == end ) start--;

      var range = this.formatter.onDelete(this.formattedData, start, end);
      evt.target.setSelectionRange(range[0], range[1]);
    },

    async function resetState() {
      this.isDelete = false;
      this.formatted = false;
      this.formatter.reset && this.formatter.reset();
      if ( this.hasOwnProperty('formattedData') )
        this.data = this.returnFormatted ? this.formattedData : this.formatter.getUnformatted(this.formattedData);
    }
  ],

  listeners: [
    {
      name: 'formatData',
      code: async function (old) {
        if ( this.formatted ) {
          this.resetState();
          return;
        }

        var el = await this.el_();
        var startingPos = el.children[0].selectionStart;
        var endPos = el.children[0].selectionEnd;

        var formatted = this.formatter.formatData(this.formattedData, old, startingPos, endPos, this.isDelete);
        if ( formatted[0] != this.formattedData ) {
          // set this to true so that when formatData is invoked by the assignment below it will return instead
          this.formatted = true;
          this.formattedData = formatted[0];
          el.children[0].setSelectionRange(formatted[1], formatted[1]);
        }
        this.resetState();
      }
    }
  ]
});
