/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Section and Search System for FOAM Markdown Documents
 * ======================================================
 *
 * Provides searchable document sections with auto-generated table of contents.
 * Sections wrap content (headings, prose, examples) into searchable units that
 * can be filtered via a shared search query.
 *
 * Registered HTML elements:
 *   <section1> - Level 1 section (like h1)
 *   <section2> - Level 2 section (like h2)
 *   <section3> - Level 3 section (like h3)
 *   <section4> - Level 4 section (like h4)
 *   <search>   - Search input that filters sections
 *   <searchcount> - Displays "Showing X of Y sections"
 *
 * Basic usage:
 *   <tocconfig index></tocconfig>
 *   <search></search>
 *   <searchcount></searchcount>
 *   <toc></toc>
 *
 *   <section1 title="Introduction">
 *     This is the intro section content.
 *   </section1>
 *
 *   <section2 title="Getting Started">
 *     More content here.
 *   </section2>
 */


/**
 * SearchState holds the shared search state for a document.
 * Tracks query, total section count, and visible section count.
 */
foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'SearchState',

  documentation: `
    Shared search state for document sections.
    Sections register themselves and the state tracks visibility counts.
  `,

  properties: [
    {
      class: 'String',
      name: 'query',
      onKey: true,
      view: 'foam.u2.SearchField',
      documentation: 'The current search query string.'
    },
    {
      class: 'Int',
      name: 'totalCount',
      documentation: 'Total number of registered sections.'
    },
    {
      class: 'Int',
      name: 'visibleCount',
      documentation: 'Number of sections currently visible (matching search).'
    }
  ],

  methods: [
    function registerSection(section) {
      /**
       * Register a section and subscribe to its shown property.
       * Increments totalCount and visibleCount (sections start visible).
       */
      this.totalCount++;
      if ( section.shown ) this.visibleCount++;

      section.shown$.sub(() => {
        this.visibleCount += section.shown ? 1 : -1;
      });
    }
  ]
});


/**
 * SearchMixin provides access to the shared SearchState in markdownContext.
 */
foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'SearchMixin',

  imports: [ 'markdownContext' ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.u2.markdown.SearchState',
      name: 'searchState',
      documentation: 'Shared search state for the document.',
      factory: function() {
        if ( ! this.markdownContext ) {
          return foam.u2.markdown.SearchState.create();
        }
        if ( ! this.markdownContext.searchState ) {
          this.markdownContext.searchState = foam.u2.markdown.SearchState.create();
        }
        return this.markdownContext.searchState;
      }
    }
  ]
});


/**
 * Section wraps document content into a searchable, collapsible unit.
 * Registers itself with SearchState for visibility tracking.
 */
foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Section',
  extends: 'foam.u2.Element',

  mixins: [
    'foam.u2.markdown.TOCMixin',
    'foam.u2.markdown.SearchMixin'
  ],

  documentation: `
    A document section that:
    - Renders a heading (h1-h4) based on level
    - Registers itself for TOC generation
    - Shows/hides based on search query matching
    - Contains arbitrary child content (prose, examples, nested sections)

    Usage:
      <section1 title="Introduction">Content here...</section1>
      <section2 title="Subsection">More content...</section2>
  `,

  css: `
    ^ {
      display: block;
    }
    ^heading {
      /* Inherit default heading styles */
    }
    ^content {
      /* Section content wrapper */
    }
  `,

  properties: [
    {
      class: 'Int',
      name: 'level',
      documentation: 'Heading level: 1-4 corresponding to h1-h4.',
      value: 1
    },
    {
      class: 'String',
      name: 'title',
      attribute: true,
      documentation: 'The section title, displayed as a heading and used in TOC.'
    },
    {
      class: 'String',
      name: 'searchText_',
      documentation: 'Cached lowercase text content for search matching.'
    }
  ],

  methods: [
    function render() {
      var self = this;

      // Register with SearchState for visibility tracking
      this.searchState.registerSection(this);

      // Subscribe to query changes
      this.onDetach(this.searchState.query$.sub(() => this.updateVisibility()));

      this.
        addClass().
        start('h' + this.level).
          addClass(this.myClass('heading')).
          add(this.title).
        end().
        start('div', null, this.content$).
          addClass(this.myClass('content')).
        end();

      // Cache search text after render completes
      // Use requestAnimationFrame to ensure DOM is populated
      requestAnimationFrame(() => this.cacheSearchText());
    },

    function cacheSearchText() {
      /**
       * Cache the section's searchable text content.
       * Includes title and all text content from children.
       */
      var text = this.title || '';
      var el = this.el_();
      if ( el ) {
        text += ' ' + (el.textContent || '');
      }
      this.searchText_ = text.toLowerCase();

      // Run initial visibility check now that we have text
      this.updateVisibility();
    },

    function updateVisibility() {
      /**
       * Update shown property based on current search query.
       */
      this.shown = this.matchesQuery(this.searchState.query);
    },

    function matchesQuery(query) {
      /**
       * Check if this section matches the search query.
       * Empty query matches everything.
       * Search is case-insensitive substring match.
       */
      if ( ! query || query.trim() === '' ) return true;
      if ( ! this.searchText_ ) return true; // Not cached yet, assume visible
      return this.searchText_.includes(query.toLowerCase());
    }
  ]
});


/**
 * Concrete section classes for each level.
 */
foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Section1',
  extends: 'foam.u2.markdown.Section',
  properties: [
    [ 'level', 1 ],
    [ 'nodeName', 'section' ]
  ]
});

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Section2',
  extends: 'foam.u2.markdown.Section',
  properties: [
    [ 'level', 2 ],
    [ 'nodeName', 'section' ]
  ]
});

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Section3',
  extends: 'foam.u2.markdown.Section',
  properties: [
    [ 'level', 3 ],
    [ 'nodeName', 'section' ]
  ]
});

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Section4',
  extends: 'foam.u2.markdown.Section',
  properties: [
    [ 'level', 4 ],
    [ 'nodeName', 'section' ]
  ]
});


/**
 * Search provides a search input that filters document sections.
 */
foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Search',
  extends: 'foam.u2.Controller',

  mixins: [ 'foam.u2.markdown.SearchMixin' ],

  documentation: `
    A search input that filters document sections in real-time.

    Usage:
      <search></search>
      <search placeholder="Filter sections..."></search>
      Search: <search></search>
  `,

  css: `
    ^ {
      display: inline-block;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'placeholder',
      attribute: true,
      value: 'Search...',
      documentation: 'Placeholder text for the search input.'
    }
  ],

  methods: [
    function render() {
      this.
        addClass().
        startContext({ data: this.searchState }).
          tag(this.searchState.QUERY, { placeholder: this.placeholder }).
        endContext();
    }
  ]
});


/**
 * SearchCount displays the number of visible/total sections.
 */
foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'SearchCount',
  extends: 'foam.u2.Element',

  mixins: [ 'foam.u2.markdown.SearchMixin' ],

  documentation: `
    Displays a count of matching sections.

    Usage:
      <searchcount></searchcount>

    Displays: "Showing 5 of 12 sections" or "12 sections"
  `,

  css: `
    ^ {
      font-size: 14px;
      color: $textSecondary;
      margin: 8px 0;
    }
  `,

  methods: [
    function render() {
      this.
        addClass().
        add(this.searchState.dynamic(function(query, visibleCount, totalCount) {
          if ( ! query || query.trim() === '' ) {
            this.add(totalCount + ' sections');
          } else {
            this.add('Showing ' + visibleCount + ' of ' + totalCount + ' sections');
          }
        }));
    }
  ]
});


/**
 * Register all section and search elements.
 */
foam.SCRIPT({
  package: 'foam.u2.markdown',
  name: 'SectionSearchTagScript',

  documentation: 'Registers section and search elements for use in markdown/HTML documents.',

  code: function() {
    foam.__context__.registerElement(foam.u2.markdown.Section1, 'section1');
    foam.__context__.registerElement(foam.u2.markdown.Section2, 'section2');
    foam.__context__.registerElement(foam.u2.markdown.Section3, 'section3');
    foam.__context__.registerElement(foam.u2.markdown.Section4, 'section4');
    foam.__context__.registerElement(foam.u2.markdown.Search, 'search');
    foam.__context__.registerElement(foam.u2.markdown.SearchCount, 'searchcount');
  }
});
