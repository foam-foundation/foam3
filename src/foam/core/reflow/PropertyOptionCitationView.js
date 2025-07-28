/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'PropertyOptionCitationView',
  extends: 'foam.u2.CitationView',
  
  documentation: 'Simple citation view for property dropdown options in PredicateView and ComparatorView',
  
  css: `
    ^row {
      display: flex;
      overflow-x: hidden;
      width: 100%;
      flex-direction: column;
      gap: 2px;
      border-bottom: 1px solid $borderXLight;
    }
    
    ^row:last-child {
      border-bottom: none;
    }
    
    ^label {
      font-size: 14px;
      font-weight: 500;
      line-height: 1.2;
    }
    
    ^value {
      font-family: monospace;
      font-size: 12px;
      color: $textSecondary;
      line-height: 1.2;
    }
  `,
  
  methods: [
    function getSummary(data) {
      return '';
    },
    
    function render() {
      this.SUPER();
      if ( ! this.data ) return;
      
      this
        .start('div')
          .addClass(this.myClass('label'))
          .add(this.data.label || this.data.value)
        .end()
        .start('div')
          .addClass(this.myClass('value'))
          .add(this.data.value)
        .end();
    }
  ]
});