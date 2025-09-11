/**
 * @license
 * Copyright 2015 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: Add datalist support.

// Should be promoted to just 'DateView' when Safari supports
// proper date fields.
foam.CLASS({
  package: 'foam.u2',
  name: 'DateView',
  extends: 'foam.u2.tag.Input',

  documentation: 'View for editing Date values.',

  mixins: [ 'foam.u2.TextInputCSS' ],

  css: `
    ^:read-only:not(:disabled) { border: none; background: rgba(0,0,0,0); margin-left: -8px; }
    ^ { height: $inputHeight; min-width: 130px; }
  `,

  messages: [
    { name: 'DATE_FORMAT', message: 'yyyy-mm-dd' }
  ],

  properties: [
    [ 'placeholder', this.DATE_FORMAT ],
    [ 'type', 'date' ]
  ],

  methods: [
    function render() {
      this.setAttribute('max', '9999-12-31');

      this.SUPER();

      // Scroll listener needed because DateView generates scroll event
      // in some foreign locales which conflicts with ScrollWizard.
      this.on('scroll', e => { e.preventDefault(); e.stopPropagation(); });

/*
      this.on('focus',  e => { console.log('focus', e); });
      this.on('blur',   e => { console.log('blur', e); });
      this.on('input',  e => { console.log('input', e); });
      this.on('change', e => { console.log('change', e); });
      this.on('beforeinput', e => { console.log('beforeinput', e); });
      */
    },

    function link() {
      if ( this.linked ) return;
      this.linked = true;
      var self    = this;
      var focused = false;
      var slot    = this.attrSlot(); //null, this.onKey ? 'input' : null);

      function updateSlot() {
        if ( focused ) return;
        var date = self.data;
        if ( foam.Number.isInstance(date) ) date = new Date(date);
        if ( ! date ) {
          slot.set('');
        } else {
          slot.set(foam.Date.toInputCompatibleDateString(date));
        }
      }

      function updateData() {
        var value = slot.get();

        var date;
        if ( value ) {
          date = foam.lang.Date.ADAPT.value.call(null, null, value);
          if ( isNaN(date) ) date = undefined;
        } else {
          date = null;
        }

        self.data = date;
      }

      if ( this.onKey ) {
        var focused = false;
        this.on('focus', () => { focused = true; });
        this.on('blur',  () => { focused = false; });
        this.on('change', updateData);
      } else {
        this.on('blur', updateData);
      }

      updateSlot();
      this.onDetach(this.data$.sub(updateSlot));
    }
  ]
});
