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
      border-bottom: 1px solid $borderXLight;
    }
    
    
    ^:last-child {
      border-bottom: none;
    }
    ^symbol {
      font-size: 14px;
    }
    
    ^propertyName {
      font-family: monospace;
      font-size: 12px;
      color: $textSecondary;
      line-height: 1.2;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap
    }
  `,

  methods: [
    function render() {
      
      var self = this;
      this
        .addClass(this.myClass())
        .add(this.slot(function(data) {
          if ( ! data ) return this.E();
          
          var symbol = '';
          var label = data.label || '';
          var propertyName = data.id || '';
          
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