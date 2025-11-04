/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'CustomStyleBorder',
  extends: 'foam.u2.Element',

  documentation: 'Border wrapper that allows per-block custom classes and custom CSS with $cssTokens.',

  sections: [
    {
      name: 'style',
      order: 100,
      properties: ['blockClasses', 'customCss']
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'blockClasses',
      section: 'style',
      documentation: 'Space-separated classes applied to the block container.'
    },
    {
      class: 'String',
      name: 'customCss',
      section: 'style',
      view: { class: 'foam.u2.tag.TextArea', rows: 6 },
      documentation: 'Custom CSS. $cssTokens supported. If no selector present, declarations are scoped to this block.'
    },
    {
      name: 'uniqueCssClass_',
      factory: function() { return 'rf-custom-border-' + this.$UID; },
      hidden: true
    },
    {
      name: 'styleEl_',
      hidden: true
    },
    {
      name: 'appliedClasses_',
      documentation: 'Tracks last applied classes so we can remove them before applying new ones.',
      hidden: true,
      value: ''
    },
    {
      name: 'targetEl_',
      documentation: 'DOM element to apply classes/tokens to. Set to closest .foam-core-reflow-Block-content ancestor.',
      hidden: true
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      // Find nearest Block content container to scope styles
      var el = this.el_ && this.el_();
      var p = el && el.parentElement;
      while ( p && ! p.classList.contains('foam-core-reflow-Block-content') ) p = p.parentElement;
      this.targetEl_ = p || el;
      if ( this.targetEl_ ) this.targetEl_.classList.add(this.uniqueCssClass_);
      this.applyBlockClasses_();
      this.updateCustomCss_();
      this.onDetach(() => {
        if ( this.styleEl_ && this.styleEl_.parentNode ) this.styleEl_.parentNode.removeChild(this.styleEl_);
        this.styleEl_ = null;
        // Cleanup classes
        try {
          if ( this.targetEl_ ) {
            if ( this.appliedClasses_ ) this.appliedClasses_.split(/\s+/).filter(Boolean).forEach(c => this.targetEl_.classList.remove(c));
            this.targetEl_.classList.remove(this.uniqueCssClass_);
          }
        } catch(e) {}
      });
    },
    function applyBlockClasses_() {
      if ( ! this.targetEl_ ) return;
      if ( this.appliedClasses_ ) this.appliedClasses_.split(/\s+/).filter(Boolean).forEach(c => this.targetEl_.classList.remove(c));
      if ( this.blockClasses ) this.blockClasses.split(/\s+/).filter(Boolean).forEach(c => this.targetEl_.classList.add(c));
      this.appliedClasses_ = this.blockClasses || '';
    },
    function updateCustomCss_() {
      console.log('updateCustomCss_ ==>', this.customCss);
      if ( this.styleEl_ && this.styleEl_.parentNode ) this.styleEl_.parentNode.removeChild(this.styleEl_);
      this.styleEl_ = null;
      if ( ! this.customCss ) return;
      var cssText = this.customCss;
      cssText = foam.CSS.replaceTokens(cssText, this.cls_, this.__subContext__);
      var hasBraces = cssText.indexOf('{') !== -1;
      if ( ! hasBraces ) {
        cssText = '.' + this.uniqueCssClass_ + ' {\n' + cssText + '\n}';
      }
      var styleEl = document.createElement('style');
      styleEl.type = 'text/css';
      try {
        var nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') || '123455443210000';
        if ( nonce ) styleEl.setAttribute('nonce', nonce);
      } catch (e) {}
      styleEl.setAttribute('data-reflow-style', this.uniqueCssClass_);
      styleEl.appendChild(document.createTextNode(cssText));
      document.head.appendChild(styleEl);
      this.styleEl_ = styleEl;
    }
  ],


  listeners: [
    {
      name: 'onBlockClassesChange',
      isFramed: true,
      on: [ 'this.propertyChange.blockClasses' ],
      code: function() { this.applyBlockClasses_(); }
    },
    {
      name: 'onCustomCssChange',
      isFramed: true,
      on: [ 'this.propertyChange.customCss' ],
      code: function() { this.updateCustomCss_(); }
    }
  ]
});


