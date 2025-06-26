/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Prompt',

  imports: [ 'params' ],

  properties: [
    {
      class: 'String',
      name: 'label'
    },
    {
      class: 'String',
      name: 'supportingLabel'
    },
    {
      class: 'String',
      name: 'urlParameter'
    },
    {
      class: 'String',
      name: 'type',
      value: 'String',
      reactive: false,
      postSet: function() { this.value = undefined; this.value; },
      view: { class: 'foam.u2.view.RadioView', choices: [
        [ 'String', 'Abc' ],
        [ 'Long',   '##' ],
        [ 'Double', '##.##' ],
        [ 'Boolean', 'Y/N' ],
        [ 'Date', 'YYYY/MM/DD' ],
        [ 'DateTime', 'YYY/MM/DD HH:MM:SS' ],
        [ 'EMail', 'username@email.com' ],
        'Color'
      ] }
    },
    {
      name: 'defaultValue',
      postSet: function(o, n) { if ( ! this.value ) this.value = n; }
    },
    {
      name: 'value',
      transient: true,
      factory: function() {
        if ( this.params && this.params[this.urlParameter] != undefined ) {
          return this.params[this.urlParameter];
        }
        return this.defaultValue;
      }
    }
  ],

  methods: [
    function toString() {
      return this.value.toString();
    },

    function valueOf() {
      return this.value.valueOf();
    },

    function addToE(e) {
      var self = this;
      e.add(this.dynamic(function(type, label, supportingLabel, value) {
        var prop = foam.lang[type].create({name: 'value', label: label, supportingLabel: supportingLabel});
        this.startContext({data: self}).add(prop.__).endContext();
      }));
    }
  ]
});
