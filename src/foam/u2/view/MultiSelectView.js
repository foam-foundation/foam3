/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */


foam.CLASS({
  package: 'foam.u2.view',
  name: 'MultiSelectView',
  extends: 'foam.u2.View',

  documentation: `
      The choices are in [value, label, isSelected ] quartets.

      However the client can simply pass in [value, label] and it will adapt to a [value, label, isSelected, choiceMode ] format
  `,

  css: `
    ^ .foam-u2-ActionView-options {
      padding: 10px;
      border: 1px solid $grey400;
      cursor: pointer;
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
      justify-content: space-between;
      background-color: $white;
      color: $black;
      border-radius: 4px;
  }
  ^choices-holder {
      background: $white;
      color: $black;
      opacity: 1;
      border: 1px solid $grey400;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 2rem;
      padding: 10px;
  }
  ^input-holder {
      display: flex;
      align-items: center;
      gap: 1rem;
      color: $black;
      width: 100%;
  }
  `,

  requires: [
      'foam.u2.md.OverlayDropdown'
  ],

  messages: [
      { name: 'OPTIONS_MSG', message: 'options' },
      { name: 'CHOOSE_1_OF_FOLLOWING_OPTIONS', message: 'Choose one of the following options' },
      { name: 'CHOOSE_AT_LEAST_1_OPTION', message: 'Choose at least one option' },
      { name: 'CHOOSE_AT_LEAST', message: 'Choose at least' },
      { name: 'CHOOSE_EXACTLY', message: 'Choose exactly' },
      { name: 'CHOOSE', message: 'Choose' }
  ],

  properties: [
      {
          class: 'String',
          name: 'placeholder',
          value: 'Options'
      },
      {
          class: 'Function',
          name: 'onSelect'
      },
      {
          name: 'choices',
          documentation: `
              An array of choices which are single choice is denoted as [value, label, isFinal]
          `,
          factory: function() {
              return [];
          },
          adapt: function(old, nu) {
              if ( foam.Object.isInstance(nu) ) {
                  var out = [];
                  for ( var key in nu ) {
                    if ( nu.hasOwnProperty(key) ) out.push([ key, nu[key] ]);
                  }
                  return out;
              }
      
              nu = foam.Array.shallowClone(nu);
      
              // Upgrade single values to [value, value].
              for ( var i = 0; i < nu.length; i++ ) {
                  if ( ! Array.isArray(nu[i]) ) {
                    nu[i] = [ nu[i], nu[i] ];
                  }
              }
              return nu;
          }
      },
      {
          name: 'data',
          factory: function() {
            return [];
          }
      },
      {
        name: 'overlay',
        factory: function() {
          let self = this;
          return this.OverlayDropdown.create({
              parentEl: this,
              closeOnLeave: true,
              lockToParentWidth: true
            })
              .addClass(this.myClass('select-modal'))
              .start().addClass(this.myClass('choices-holder'))
                  .forEach(this.choices, function(choice) {
                    var isSelected = self.data?.includes(choice[1]);
                    this
                        .start().addClass(self.myClass('input-holder'))
                          .tag(foam.u2.CheckBox, { data$: isSelected, label: choice[0] })
                          .on('change', function (evt) {
                                    self.onSelect(choice[1]);
                                })
                            
                    .end();
                  })
              .end();          
        }
      }
  ],

  actions: [
    {
      name: 'options',
      themeIcon: 'dropdown',
      code: async function() {
        this.add(this.overlay)
      }  
    }
  ],
  methods: [
      function render() {
          this.startContext({ data: this })
            .tag(this.OPTIONS, {label: this.placeholder})
          .endContext();
      } 
  ]
})