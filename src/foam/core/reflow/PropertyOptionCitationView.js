/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyOptionCitationView',
  extends: 'foam.u2.View',
  
  documentation: 'Citation view for property options in dropdowns',
  
  css: `
    ^ {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 0px;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    ^:hover {
      background-color: $grey50;
    }
    
    ^separator {
      font-weight: 600;
      color: $grey400;
      cursor: default;
    }
    
    ^separator:hover {
      background-color: transparent;
    }
    
    ^main-row {
      display: flex;
      align-items: center;
      width: 100%;
    }
    
    ^direction {
      font-weight: 600;
      margin-right: 8px;
      color: $primary400;
    }
    
    ^label {
      flex: 1;
    }
    
    ^property-name {
      color: $textSecondary;
      font-size: 0.9em;
      margin-left: 8px;
    }
  `,
  
  methods: [
    function render() {
      var self = this;
      var PropertySuggestedField = foam.core.reflow.PropertySuggestedField;
      
      this.
        addClass().
        enableClass(this.myClass('separator'), this.data.isSeparator).
        callIf(! this.data.isSeparator, function() {
          // Extract property name from the label
          var label = self.data.label || '';
          var propertyName = '';
          
          // For ComparatorOption, remove the direction indicator from label
          if ( label.startsWith(PropertySuggestedField.SORT_ASC_SYMBOL + ' ') || 
               label.startsWith(PropertySuggestedField.SORT_DESC_SYMBOL + ' ') ) {
            label = label.substring(2);
          }
          
          // Use the raw value as property name (keeps '-' prefix)
          if ( self.data.value ) {
            propertyName = self.data.value;
          }
          
          // For ComparatorOption with direction, put everything in one row
          if ( self.data.direction ) {
            this.
              start('div').
                addClass(self.myClass('main-row')).
                start('span').
                  addClass(self.myClass('direction')).
                  add(self.data.direction === 'DESC' ? PropertySuggestedField.SORT_DESC_SYMBOL : PropertySuggestedField.SORT_ASC_SYMBOL).
                end().
                start('span').
                  addClass(self.myClass('label')).
                  add(label).
                end().
                callIf(propertyName && propertyName !== label, function() {
                  this.
                    start('span').
                      addClass(self.myClass('property-name')).
                      add(propertyName).
                    end();
                }).
              end();
          } else {
            // For PredicateOption, keep the column layout
            this.
              start('span').
                addClass(self.myClass('label')).
                add(label).
              end();
            
            // Show property name if it's different from the label
            if ( propertyName && propertyName !== label ) {
              this.
                start('span').
                  addClass(self.myClass('property-name')).
                  add(propertyName).
                end();
            }
          }
        }).
        callIf(this.data.isSeparator, function() {
          this.
            start('span').
              addClass(self.myClass('label')).
              add(self.data.label).
            end();
        });
    }
  ]
});