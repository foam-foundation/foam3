/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.tag',
  name: 'Select',
  extends: 'foam.u2.View',

  mixins: [ 'foam.u2.TextInputCSS' ],

  css: `
    <<:disabled {
      appearance: none;
      -moz-appearance: none;
      -webkit-appearance: none;
    }
    << {
      appearance: none;
      -moz-appearance: none;
      -webkit-appearance: none;
      background: url('/images/dropdown-icon.svg') no-repeat;
      background-color: $backgroundDefault;
      background-position: right 0.5em top 50%, 0 0;
      box-shadow: none;
      cursor: pointer;
      height: $inputHeight;
      max-width: 100%;
      overflow: hidden;
      padding-top: 1px;
      padding-bottom: 1px;
      padding-right: 22px;
      text-overflow: ellipsis;
      width: 100%;
    }
    << option {
      padding: 4px;
      width: 100%;
    }
    <<.expanded {
      background: none;
      padding: 0;
    }
  `,

  properties: [
    {
      name: 'data',
      preSet: function(o, n) {
        // Happens when old choices are deleted and attrSlot temporarily reverts to ''
        return n === '' ? o : n;
      }
    },
    ['nodeName', 'select'],
    {
      name: 'choices',
      documentation: `Array of [value, text] choices. You can pass in just
          an array of strings, which are expanded to [str, str]. Can also
          be a map, which results in [key, value] pairs listed in
          enumeration order.`,
      adapt: function(old, nu) {
        if ( typeof nu === 'object' && ! Array.isArray(nu) ) {
          var out = [];
          for ( var key in nu ) {
            if ( nu.hasOwnProperty(key) ) out.push([ key, nu[key] ]);
          }
          if ( this.dynamicSize ) {
            this.size = Math.min(out.length, this.maxSize);
          }
          return out;
        }

        nu = foam.Array.shallowClone(nu);

        // Upgrade single values to [value, value].
        for ( var i = 0 ; i < nu.length ; i++ ) {
          if ( ! Array.isArray(nu[i]) ) {
            nu[i] = [ nu[i], nu[i] ];
          }
        }

        if ( this.dynamicSize ) this.size = Math.min(nu.length, this.maxSize);
        return nu;
      },
      factory: function() {
        return [];
      }
    },
    {
      name: 'placeholder',
      factory: function() {
        return undefined;
      }
    },
    'size',
    {
      name: 'header',
      documentation: 'The heading text for the choices'
    },
    {
      name: 'disabledData',
      documentation: 'Optional list of disabled choices that should not be selectable',
      factory: function() {
        return [];
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;

      this
        .addClass(this.myClass())
        .attrs({size: this.size$})
        .enableClass('expanded', this.size != 0 )
        .attrs({ role: 'combobox' })
        .attrSlot().linkFrom(this.data$);

      if ( this.size ) this.style({height: 'auto'});

      this.add(this.dynamic(function(choices, placeholder, header, data, disabledData) {
        if ( header ) {
          this.start('optgroup').attrs({ label: header });
        }

        if ( placeholder ) {
          this.start('option').attrs({
            value: -1,
            selected: self.data === -1
          }).addClass('truncate-ellipsis').add(placeholder);
        }

        for ( var i = 0 ; i < choices.length ; i++ ) {
          var c          = choices[i];
          let value      = c[1];
          var isSelected = data == i;
          this.start('option').attrs({
            value: i,
            selected: isSelected,
            disabled: ! isSelected && disabledData.some(o => foam.util.equals(o, value))
          }).translate(value + '.name', value);
        }
      }));
    },

    function updateMode_(mode) {
      var disabled =
        mode === foam.u2.DisplayMode.DISABLED ||
        mode === foam.u2.DisplayMode.RO;
      this.setAttribute('disabled', disabled);
    }
  ]
});
