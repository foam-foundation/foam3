/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2',
  name: 'StyleConfigurator',

  imports: ['installCSS'],

  documentation: `Mixin that models some basic css styling properties.
  Useful when end users need to configure the look and feel of an element.
  Look at foam.core.reflow.Block for implementation`,

  sections: [
    {
      name: 'styleSection',
      title: 'Style Configuration',
      properties: [ 'padding_st', 'background_st', 'border_st', 'borderRadius_st', 'boxShadow_st', 'extraCSS_st' ]
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'padding_st',
      label: 'Padding',
      optionalBorder: true,
      reactive: false
    },
    {
      class: 'String',
      name: 'background_st',
      label: 'Background',
      optionalBorder: true,
      onKey: true,
      view: function(_, X) {
        var data = X.data;
        let p = foam.u2.parse.CSSParser.create({});
        return {
          class: 'foam.parse.auto.SmartView',
          parser: p.grammar_.getSymParser('colorPropertyValue')
        };
      },
      reactive: false
    },
    {
      class: 'String',
      name: 'border_st',
      label: 'Border',
      optionalBorder: true,
      onKey: true,
      view: function(_, X) {
        var data = X.data;
        let p = foam.u2.parse.CSSParser.create({});
        return {
          class: 'foam.parse.auto.SmartView',
          parser: p.grammar_.getSymParser('borderValue')
        };
      },
      reactive: false
    },
    {
      class: 'String',
      name: 'borderRadius_st',
      label: 'Border Radius',
      optionalBorder: true,
      reactive: false
    },
    {
      class: 'String',
      name: 'boxShadow_st',
      label: 'Box Shadow',
      optionalBorder: true,
      reactive: false
    },
    {
      class: 'String',
      name: 'extraCSS_st',
      label: 'Extra CSS',
      optionalBorder: true,
      reactive: false,
      view: 'foam.u2.tag.TextArea',
      documentation: 'Will override the above properties'
    },
    {
      name: 'addToEl_st',
      hidden: true
    }
  ],
  methods: [
    function initCSSProps(addTo) {
      // Expects an element to add all the css to
      if ( ! addTo ) {
        if ( ! this.addToEl_st ) {
          console.warn('No element was provided to add CSS properties to in StyleConfigurator; defaulting to the mixin parent.')
          addTo = this;
        } else {
          addTo = this.addToEl_st;
        }
      }
      // If running the first time, store the element
      if ( ! this.addToEl_st ) this.addToEl_st = addTo;

      let configClass = foam.String.cssClassize(addTo.cls_.id) + '-' + this.$UID;
      addTo.addClass(configClass);
      let cssString = `
        ^ {
          padding: ${this.padding_st ?? 'none'};
          background: ${this.background_st ?? 'none'};
          border: ${this.border_st ?? 'none'};
          border-radius: ${this.borderRadius_st ?? 'none'};
          box-shadow: ${this.boxShadow_st ?? 'none'};
        }
      `;
      if ( this.extraCSS_st ) {
        if ( this.extraCSS_st?.indexOf('{') !== -1 ) {
          cssString += this.extraCSS_st;
        } else {
          cssString += `
            ^ {
              ${this.extraCSS_st}
            }
          `;
        }
      }
      let ax = foam.u2.CSS.create({ code: cssString }, addTo);
      let expandedCSS = ax.expandCSS(addTo.cls_, ax.code, addTo.__subContext__, configClass);
      this.installCSS(expandedCSS, this.$UID, this.$UID + 'styleConfig');
    }
  ],
  listeners: [
    {
      name: 'updateCSS',
      isFramed: true,
      on: [
        'this.propertyChange.padding_st',
        'this.propertyChange.background_st',
        'this.propertyChange.border_st',
        'this.propertyChange.boxShadow_st',
        'this.propertyChange.extraCSS_st',
        'this.propertyChange.borderRadius_st'
      ],
      code: function() {
        document.getElementById(this.$UID+ 'styleConfig')?.remove();
        this.initCSSProps();
      }
    }
  ]
});
