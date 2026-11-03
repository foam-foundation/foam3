/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.demos.sevenguis',
  name: 'FlightBooker',
  extends: 'foam.u2.Controller', // can be commented out and remove render

  requires: [
    'foam.u2.DateView',
    'foam.u2.tag.Select'
  ],

  imports: [ 'window' ],

  css: `
    << { padding: 10px; }
    <<title, << button, << input,  << select {
      width: 210px; height: 28px; margin-top: 16px; display: flex;
    }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'isReturn',
      label: '',
      value: true,
      view: {
        class: 'foam.u2.view.ChoiceView',
        choices: [
          [ false, 'one-way flight' ],
          [ true,  'return flight'  ]
        ]
      }
    },
    {
      class: 'Date',
      name: 'departDate',
      label: '',
      factory: function() { return new Date(Date.now()+3600000*24); },
      validateObj: function(departDate) {
        var today = new Date();
        today.setHours(0,0,0,0);
        if ( foam.Date.compare(departDate, today) < 0 ) return 'Must not be in the past.';
      }
    },
    {
      class: 'Date',
      name: 'returnDate',
      label: '',
      factory: function() { return new Date(Date.now()+2*3600000*24); },
      visibility: function(isReturn) {
        return isReturn ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      },
      validateObj: function(isReturn, returnDate, departDate) {
        if ( isReturn && foam.Date.compare(returnDate, departDate) < 0 ) return 'Must not be before depart date.';
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.
        addClass(this.myClass()).
        start('div').addClass('p-lg', this.myClass('title')).add('Book Flight').end().
        add(this.IS_RETURN.__).
        add(this.DEPART_DATE.__).
        add(this.RETURN_DATE.__).
        add(this.BOOK);
    }
  ],

  actions: [
    {
      name: 'book',
      isEnabled: function(errors_) { return ! errors_; },
      code: function() {
        var depart = this.departDate.toLocaleDateString(foam.locale);

        this.window.alert('You have booked a ' + (this.isReturn ?
          'flight departing on ' + depart + ' and returning ' + this.returnDate.toLocaleDateString(foam.locale):
          'one-way flight on ' + depart) + '.');
      }
    }
  ]
});
