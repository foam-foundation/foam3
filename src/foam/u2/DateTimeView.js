/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: Add datalist support.

foam.CLASS({
  package: 'foam.u2',
  name: 'DateTimeView',
  extends: 'foam.u2.tag.Input',

  documentation: 'View for editing DateTime values.',

  mixins: [ 'foam.u2.TextInputCSS' ],

  imports: [
    'dateService?'
  ],

  css: `
    ^:read-only:not(:disabled) { border: none; background: rgba(0,0,0,0); margin-left: -8px; }
    ^ { height: $inputHeight; min-width: 130px; }
    }
  `,

  messages: [
    { name: 'DATE_FORMAT', message: 'yyyy-mm-dd hh:mm' }
  ],

  properties: [
    [ 'placeholder', this.DATE_FORMAT ],
    [ 'type', 'datetime-local' ]
  ],

  methods: [
    function render() {
      this.SUPER();

      // Scroll listener needed because DateView generates scroll event
      // in some foreign locales which conflicts with ScrollWizard.
      this.on('scroll', e => { e.preventDefault(); e.stopPropagation(); });
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
          slot.set(foam.Date.toInputCompatibleDateTimeString(date));
        }
      }

      async function updateData() {
        var value = slot.get();

        var date;
        if ( value ) {
          // Use DateService exclusively - no fallbacks
          if ( self.dateService ) {
            // Use parseDateTimeString for full datetime parsing
            date = await self.dateService.parseDateTimeString(self.__context__, value);
            if ( isNaN(date) ) date = undefined;
          } else {
            console.error('DateService not available');
            date = undefined;
          }
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
