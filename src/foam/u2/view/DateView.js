/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'DateView',
  extends: 'foam.u2.view.ModeAltView',

  documentation: 'A view for foam.lang.Date properties.',

  requires: [
    'foam.u2.DateView',
    'foam.u2.view.date.DateTimePicker'
  ],

  constants: [
    {
      // Choose the delegate based on browser compatibility. The DateTimePicker
      // arm is dead: this once covered Safari, which has supported
      // <input type="date"> since 14.1 (2021), so no current browser takes it.
      // TODO: drop the branch and the DateTimePicker class.
      name: 'READ_DELEGATE',
      factory: function() {
        var e = document.createElement('input');
        e.setAttribute('type', 'date');
        return e.type === 'text' ?
          'foam.u2.view.date.DateTimePicker' :
          'foam.u2.view.date.RODateView' ;
      }
    },
    {
      // Choose the delegate based on browser compatibility. The DateTimePicker
      // arm is dead: this once covered Safari, which has supported
      // <input type="date"> since 14.1 (2021), so no current browser takes it.
      // TODO: drop the branch and the DateTimePicker class.
      name: 'WRITE_DELEGATE',
      factory: function() {
        var e = document.createElement('input');
        e.setAttribute('type', 'date');
        return e.type === 'text' ?
          'foam.u2.view.date.DateTimePicker' :
          'foam.u2.DateView' ;
      }
    }
  ],

  properties: [
    {
      name: 'readView',
      factory: function() { return { class: this.READ_DELEGATE }; }
    },
    {
      name: 'writeView',
      factory: function() { return { class: this.WRITE_DELEGATE }; }
    }
  ]
});
