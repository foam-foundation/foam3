/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Glossary System for FOAM Markdown Documents
 * ============================================
 *
 * Provides inline term definitions with popup lookups and auto-generated glossaries.
 * Terms are stored in a shared markdownContext, enabling composable documents where
 * definitions can be scattered across included segments and collected at render time.
 *
 * Registered HTML elements:
 *   <def>      - Define a term (TermDefinition)
 *   <term>     - Reference a term with popup (TermReference)
 *   <glossary> - Render collected definitions (Glossary)
 *
 * Basic usage:
 *   <glossary>
 *     <def term="DAO" definition="Data Access Object."></def>
 *     <def term="FOAM" definition="Feature-Oriented Active Modeller." source="foam-framework.github.io"></def>
 *   </glossary>
 *
 *   <p>The <term term="FOAM"></term> framework uses <term term="DAO"></term>s.</p>
 *
 * Composable usage (definitions from multiple included documents):
 *   <!-- chapter1.md -->
 *   <def term="DAO" definition="Data Access Object."></def>
 *   <p>A <term term="DAO"></term> provides CRUD operations...</p>
 *
 *   <!-- chapter2.md -->
 *   <def term="MDAO" definition="In-memory DAO."></def>
 *   <p>For testing, use <term term="MDAO"></term>...</p>
 *
 *   <!-- book.md -->
 *   <include src="chapter1.md"></include>
 *   <include src="chapter2.md"></include>
 *   <glossary></glossary>  <!-- Collects DAO and MDAO -->
 */

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'GlossaryMixin',

  documentation: `
    Shared mixin providing access to the glossary term registry.
    Terms are stored in markdownContext.glossaryTerms, allowing definitions
    and references across document boundaries to share the same term map.
  `,

  imports: [ 'markdownContext' ],

  properties: [
    {
      name: 'terms',
      documentation: 'Map of lowercase term names to TermDefinition objects. Lazily created in markdownContext.',
      factory: function() {
        if ( ! this.markdownContext ) return {};
        return this.markdownContext.glossaryTerms || (this.markdownContext.glossaryTerms = {});
      }
    }
  ],

  methods: [
    function addTerm(term) {
      /** Register a TermDefinition in the shared glossary. */
      this.terms[term.term.toLowerCase()] = term;
      return this;
    },

    function lookupTerm(term) {
      /** Retrieve a TermDefinition by name (case-insensitive). */
      return this.terms[term.toLowerCase()];
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'TermDefinition',
  extends: 'foam.u2.Element',

  documentation: `
    Defines a glossary term. Renders nothing visible but registers itself
    in the shared term registry on init.

    Usage: <def term="API" definition="Application Programming Interface." source="Optional citation"></def>

    Attributes:
      term       - The term being defined (required)
      definition - The definition text (required)
      source     - Optional source or citation
  `,

  mixins: [ 'foam.u2.markdown.GlossaryMixin' ],

  properties: [
    {
      class: 'String',
      name: 'term',
      attribute: true,
      required: true
    },
    {
      class: 'String',
      name: 'definition',
      attribute: true,
      required: true
    },
    {
      class: 'String',
      name: 'source',
      attribute: true,
      documentation: 'Optional source or reference for the definition.'
    }
  ],

  methods: [
    function init() {
      this.addTerm(this);
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'TermReference',
  extends: 'foam.u2.View',

  documentation: `
    Displays a hyperlinked term that shows a popup definition on click.
    Looks up the term from the shared glossary registry.

    Usage: <term term="API"></term>

    The term text is displayed with a dotted underline. Clicking shows a
    popup with the term name, definition, and optional source. The popup
    closes when clicking outside or on the X button.

    If the term has not been defined via <def>, a warning is logged and
    the term displays without popup functionality.
  `,

  mixins: [ 'foam.u2.markdown.GlossaryMixin' ],

  imports: [ 'document' ],

  css: `
    ^ {
      display: inline;
    }

    ^term {
      color: $textBrand;
      text-decoration: underline;
      text-decoration-style: dotted;
      cursor: pointer;
      position: relative;
    }

    ^term:hover {
      color: $primary500;
    }

    ^popup {
      position: absolute;
      z-index: 1000;
      background: $white;
      border: 1px solid $borderDefault;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 12px 16px;
      max-width: 320px;
      min-width: 200px;
      font-size: 14px;
      line-height: 1.5;
    }

    ^popup-header {
      font-weight: $font-medium;
      color: $textDefault;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid $borderLight;
    }

    ^popup-definition {
      color: $textSecondary;
    }

    ^popup-source {
      margin-top: 8px;
      font-size: 12px;
      color: $textTertiary;
      font-style: italic;
    }

    ^popup-close {
      position: absolute;
      top: 8px;
      right: 10px;
      cursor: pointer;
      color: $grey400;
      font-size: 16px;
      line-height: 1;
    }

    ^popup-close:hover {
      color: $textDefault;
    }
  `,

  properties: [
    {
      name: 'data',
      documentation: 'The TermDefinition object, looked up from the glossary by term name.',
      expression: function(term) {
        return this.lookupTerm(term);
      }
    },
    {
      class: 'String',
      name: 'term',
      attribute: true
    },
    {
      class: 'String',
      name: 'definition',
      attribute: true,
      documentation: 'Derived from data; can be overridden inline for ad-hoc definitions.',
      expression: function(data) {
        return data?.definition || '';
      }
    },
    {
      class: 'String',
      name: 'source',
      attribute: true,
      expression: function(data) {
        return data?.source || '';
      }
    },
    {
      class: 'Boolean',
      name: 'showPopup',
      value: false
    },
    {
      name: 'popupE_',
      documentation: 'Reference to the popup element for positioning adjustments.'
    }
  ],

  methods: [
    function render() {
      var self = this;

      this.
        addClass().
        start('span').
          addClass(this.myClass('term')).
          add(this.term$).
          on('click', this.togglePopup).
        end().
        add(this.slot(function(showPopup) {
          if ( ! showPopup ) return null;
          return self.E().
            addClass(self.myClass('popup')).
            call(function() { self.popupE_ = this; }).
            start('span').
              addClass(self.myClass('popup-close')).
              add('×').
              on('click', self.closePopup).
            end().
            start('div').
              addClass(self.myClass('popup-header')).
              add(self.term$).
            end().
            start('div').
              addClass(self.myClass('popup-definition')).
              add(self.definition$).
            end().
            callIf(self.source, function() {
              this.start('div').
                addClass(self.myClass('popup-source')).
                add('— ', self.source$).
              end();
            });
        }));
    },

    function positionPopup() {
      /** Adjust popup position if it would overflow the viewport. */
      if ( ! this.popupE_?.el_() ) return;

      var popup = this.popupE_.el_();
      var rect = popup.getBoundingClientRect();
      var viewportWidth = window.innerWidth;
      var viewportHeight = window.innerHeight;

      if ( rect.right > viewportWidth ) {
        popup.style.left = 'auto';
        popup.style.right = '0';
      }

      if ( rect.bottom > viewportHeight ) {
        popup.style.top = 'auto';
        popup.style.bottom = '100%';
        popup.style.marginBottom = '4px';
      }
    }
  ],

  listeners: [
    function togglePopup(e) {
      e.stopPropagation();
      this.showPopup = ! this.showPopup;

      if ( this.showPopup ) {
        this.onDetach(this.document.addEventListener('click', this.onDocumentClick));
        setTimeout(() => this.positionPopup(), 0);
      }
    },

    function closePopup() {
      this.showPopup = false;
    },

    function onDocumentClick(e) {
      if ( this.showPopup && this.popupE_?.el_() && ! this.popupE_.el_().contains(e.target) ) {
        this.closePopup();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Glossary',
  extends: 'foam.u2.Controller',

  documentation: `
    Renders a formatted glossary of all registered terms.

    Can be used as a container for <def> tags or standalone to collect
    terms defined elsewhere in the document.

    Usage:
      <!-- Container style -->
      <glossary>
        <def term="DAO" definition="Data Access Object."></def>
        <def term="View" definition="A reactive UI component."></def>
      </glossary>

      <!-- Collector style (terms defined elsewhere) -->
      <glossary></glossary>

    Terms are rendered alphabetically with their definitions and optional sources.
  `,

  mixins: [ 'foam.u2.markdown.GlossaryMixin' ],

  css: `
    ^entry { margin-bottom: 16px; }
    ^entry dt { font-weight: $font-medium; color: $textDefault; }
    ^entry dd { margin-left: 0; margin-top: 4px; color: $textSecondary; }
    ^source { font-size: 0.9em; color: $textTertiary; font-style: italic; }
  `,

  methods: [
    async function render() {
      this.SUPER();
      this.start('h1').add('Glossary').end();

      // Brief delay to allow any sibling/child <def> tags to register.
      // Necessary because element initialization order isn't guaranteed
      // when composing documents from multiple sources.
      await foam.async.sleep(10);

      var self = this;
      var keys = Object.keys(this.terms).sort();

      keys.forEach(function(key) {
        var term = self.terms[key];
        self.start('div').
          addClass(self.myClass('entry')).
          start('dt').add(term.term).end().
          start('dd').
            add(term.definition).
            callIf(term.source, function() {
              this.start('span').
                addClass(self.myClass('source')).
                add(' — ', term.source).
              end();
            }).
          end().
        end();
      });
    },

    function termView(term) {
      /** Programmatic API: returns a TermReference view for the given term. */
      var t = this.lookupTerm(term);
      if ( ! t ) {
        console.warn('Glossary term not found:', term);
        return foam.u2.Element.create().add(term);
      }
      return foam.u2.markdown.TermReference.create({ data: t });
    }
  ]
});


foam.SCRIPT({
  package: 'foam.u2.markdown',
  name: 'GlossaryTagScript',

  documentation: 'Registers glossary-related custom elements for use in markdown/HTML documents.',

  code: function() {
    foam.__context__.registerElement(foam.u2.markdown.Glossary);        // <glossary>
    foam.__context__.registerElement(foam.u2.markdown.TermReference, 'term');  // <term>
    foam.__context__.registerElement(foam.u2.markdown.TermDefinition, 'def');  // <def>
  }
});
