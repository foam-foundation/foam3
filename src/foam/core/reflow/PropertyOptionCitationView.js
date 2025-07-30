/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyOptionCitationView',
  extends: 'foam.u2.CitationView',

  documentation: 'Custom row view for PropertyOption that displays symbol, label, and property name',

  css: `
    ^ {
      display: flex;
      overflow-x: hidden;
      width: 100%;
      flex-direction: column;
      gap: 2px;
      border-bottom: 1px solid $borderXLight;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    
    ^:hover {
      background-color: $backgroundSecondary;
    }
    
    ^:last-child {
      border-bottom: none;
    }
    
    ^label {
      font-weight: 500;
      line-height: 1.2;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    ^symbol {
      font-size: 14px;
      font-weight: 500;
      line-height: 1.2;
    }
    
    ^propertyName {
      font-family: monospace;
      font-size: 12px;
      color: $textSecondary;
      line-height: 1.2;
    }
  `,

  methods: [
    function render() {
      this.SUPER();
      
      var self = this;
      this
        .addClass(this.myClass())
        .add(this.slot(function(data) {
          if ( ! data ) return this.E();
          
          var symbol = '';
          var label = data.label || '';
          var propertyName = data.id || '';
          
          // Extract symbol from label if present
          if ( label.startsWith('↑ ') ) {
            symbol = '↑';
            label = label.substring(2);
          } else if ( label.startsWith('↓ ') ) {
            symbol = '↓';
            label = label.substring(2);
          }
          
          return this.E()
            .start('div')
              .addClass(self.myClass('label'))
              .callIf(symbol, function() {
                this.start('span')
                  .addClass(self.myClass('symbol'))
                  .add(symbol)
                .end();
              })
              .add(label)
            .end()
            .start('div')
              .addClass(self.myClass('propertyName'))
              .add(propertyName)
            .end();
        }));
    }
  ]
});