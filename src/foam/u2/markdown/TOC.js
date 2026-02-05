/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Table of Contents System for FOAM Markdown Documents
 * =====================================================
 *
 * Provides hierarchical section headings with auto-generated table of contents.
 * Headings are stored in a shared markdownContext, enabling composable documents
 * where sections from included segments are collected at render time.
 *
 * Registered HTML elements:
 *   <h1> - Level 1 heading (Heading, level=1)
 *   <h2> - Level 2 heading (Heading, level=2)
 *   <h3> - Level 3 heading (Heading, level=3)
 *   <h4> - Level 4 heading (Heading, level=4)
 *   <toc> - Render table of contents (TableOfContents)
 *   <tocconfig> - Configure TOC behavior (TOCConfig)
 *
 * Basic usage:
 *   <toc></toc>
 *
 *   <h1>Introduction</h1>
 *   <p>Some content...</p>
 *
 *   <h2>Background</h2>
 *   <p>More content...</p>
 *
 * Indexed usage (numbered sections):
 *   <tocconfig index></tocconfig>
 *   <toc></toc>
 *
 *   <h1>Introduction</h1>
 *   <h2>Background</h2>
 *
 *   Renders headings as:
 *     1. Introduction
 *     1.1. Background
 *
 * TOC at end of document:
 *   <tocconfig index></tocconfig>
 *
 *   <h1>Introduction</h1>
 *   <h2>Background</h2>
 *
 *   <toc></toc>  <!-- Still numbers correctly -->
 *
 * Composable usage (headings from multiple included documents):
 *   <!-- book.md -->
 *   <tocconfig index></tocconfig>
 *   <toc></toc>
 *   <include src="chapter1.md"></include>
 *   <include src="chapter2.md"></include>
 */

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'TOCMixin',

  documentation: `
    Shared mixin providing access to the heading registry and index state.
    Headings are stored in markdownContext.tocHeadings as an ordered array.
    Index counters track current numbering at each level.
  `,

  imports: [ 'markdownContext' ],

  properties: [
    {
      name: 'headings',
      documentation: 'Ordered array of Heading objects. Lazily created in markdownContext.',
      factory: function() {
        if ( ! this.markdownContext ) return [];
        return this.markdownContext.tocHeadings || (this.markdownContext.tocHeadings = []);
      }
    },
    {
      name: 'tocConfig',
      documentation: 'Shared TOC configuration. Set by TOCConfig tag.',
      factory: function() {
        if ( ! this.markdownContext ) {
          return foam.u2.markdown.TOCConfigState.create();
        }
        return this.markdownContext.tocConfig ||
          (this.markdownContext.tocConfig = foam.u2.markdown.TOCConfigState.create());
      }
    }
  ],

  methods: [
    function addHeading(heading) {
      /** Register a Heading in the shared registry. */
      this.headings.push(heading);
      return this;
    },

    function getNextIndex(level) {
      /**
       * Get the next section number for the given level (1-4).
       * Increments the counter at this level and resets all deeper levels.
       * Returns a string like "1" or "2.3" or "2.3.1".
       */
      var counters = this.tocConfig.counters;
      var idx = level - 1;

      // Increment this level
      counters[idx]++;

      // Reset deeper levels
      for ( var i = idx + 1; i < counters.length; i++ ) {
        counters[i] = 0;
      }

      return this.getCurrentIndex(level);
    },

    function getCurrentIndex(level) {
      var counters = this.tocConfig.counters;
      // Build the index string (e.g., "2.3.1")
      return counters.slice(0, level).join('.');
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'TOCConfigState',

  documentation: `
    Modelled state for TOC configuration. Using a proper FOAM class enables
    reactive updates if needed in the future.
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'index',
      documentation: 'When true, headings display hierarchical numbering.',
      value: false
    },
    {
      name: 'counters',
      documentation: 'Current index counters for each heading level.',
      factory: function() { return [0, 0, 0, 0]; }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'TOCConfig',
  extends: 'foam.u2.Element',

  documentation: `
    Configures table of contents behavior. Place before first heading to
    ensure headings see the configuration during their render.

    Usage:
      <tocconfig index></tocconfig>

    Attributes:
      index - If present, enables hierarchical numbering (1, 1.1, 1.2, 2, etc.)
              for both the TOC entries and the heading elements themselves.

    This tag renders nothing visible. It purely sets configuration that
    headings and the TOC read from the shared markdownContext.
  `,

  mixins: [ 'foam.u2.markdown.TOCMixin' ],

  properties: [
    {
      class: 'Boolean',
      name: 'index',
      attribute: true,
      documentation: 'When true, enables hierarchical numbering on headings.'
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      // Set immediately so headings see it during their render
      this.tocConfig.index = this.index;
    },

    function render() {
      // Renders nothing - purely configuration
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Heading',
  extends: 'foam.u2.Element',

  documentation: `
    A section heading that registers itself for table of contents generation.

    Usage:
      <h1>Chapter Title</h1>
      <h2>Section Title</h2>
      <h3>Subsection Title</h3>
      <h4>Sub-subsection Title</h4>

    When index mode is enabled via <tocconfig index>, headings display with
    hierarchical numbering (e.g., "2.3.1 Subsection Title").

    Each heading generates an anchor ID for deep linking from the TOC.
  `,

  mixins: [ 'foam.u2.markdown.TOCMixin' ],

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
      documentation: 'The heading text. Can be set via attribute or element content.'
    },
    {
      class: 'String',
      name: 'sectionIndex',
      documentation: 'Computed section number (e.g., "2.3") when indexing is enabled.'
    },
    {
      class: 'String',
      name: 'anchorId',
      documentation: 'URL-safe anchor ID for deep linking.',
      expression: function(title, sectionIndex) {
        var base = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
        return sectionIndex ? 'section-' + sectionIndex.replace(/\./g, '-') + '-' + base : base;
      }
    }
  ],

  methods: [
    function addChild_(c, p) {
      if ( foam.String.isInstance(c) ) { this.title += c; }
      return this.SUPER(c, p);
    },

    function render() {
      this.addHeading(this);
      var self = this;

      // Compute section index if TOCConfig has enabled indexing
      if ( this.tocConfig.index ) {
        this.sectionIndex = this.getNextIndex(this.level);
      }

      this.
        attrs({ id: this.anchorId$ }).
        addClass(this.myClass('h' + this.level)).
        add(this.slot(function(sectionIndex) {
          return sectionIndex ? sectionIndex + '. ' : '';
        })).
        add(this.title);
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'TableOfContents',
  extends: 'foam.u2.Controller',

  documentation: `
    Renders a table of contents from all registered headings.

    Usage:
      <toc></toc>           <!-- Simple TOC -->

    For numbered sections, use <tocconfig index> before the first heading:
      <tocconfig index></tocconfig>
      <toc></toc>
      <h1>Introduction</h1>

    Attributes:
      title - Title displayed above the TOC. Defaults to "Table of Contents".
              Set to empty to hide.

    The TOC renders as a nested list with links to each heading's anchor.
    Headings are displayed in document order with proper nesting based on level.
  `,

  mixins: [ 'foam.u2.markdown.TOCMixin' ],

  css: `
    ^ { margin: 20px 0; }
    ^title { font-size: 1.25em; font-weight: $font-medium; margin-bottom: 12px; }
    ^list { list-style: none; padding: 0; margin: 0; }
    ^item { margin: 4px 0; }
    ^item a { color: $textBrand; text-decoration: none; }
    ^item a:hover { text-decoration: underline; }
    ^level-1 { margin-left: 0; font-weight: $font-regular; }
    ^level-2 { margin-left: 20px; }
    ^level-3 { margin-left: 40px; }
    ^level-4 { margin-left: 60px; }
  `,

  properties: [
    {
      class: 'String',
      name: 'title',
      attribute: true,
      value: 'Table of Contents',
      documentation: 'Title displayed above the TOC. Set to empty to hide.'
    }
  ],

  methods: [
    async function render() {
      this.SUPER();
      this.addClass();

      // Brief delay to allow sibling/child headings to register.
      // Necessary because element initialization order isn't guaranteed
      // when composing documents from multiple sources.
      await foam.async.sleep(10);

      var self = this;

      this.
        callIf(this.title, function() {
          this.start('div').addClass(self.myClass('title')).add(self.title).end();
        }).
        start('ul').
          addClass(this.myClass('list')).
          call(function() {
            self.renderEntries(this);
          }).
        end();
    },

    function renderEntries(ul) {
      /** Render TOC entries, computing indices if index mode is enabled. */
      var self = this;
      var counters = [0, 0, 0, 0];
      var index = this.tocConfig.index;

      ul.forEach(this.headings, function(heading) {
        var idx = heading.level - 1;

        // Compute index for this entry
        counters[idx]++;
        for ( var i = idx + 1; i < counters.length; i++ ) {
          counters[i] = 0;
        }
        var sectionIndex = counters.slice(0, heading.level).join('.');

        var displayText = index
          ? sectionIndex + '. ' + heading.title
          : heading.title;

        var anchorId = index
          ? 'section-' + sectionIndex.replace(/\./g, '-') + '-' + (heading.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          : (heading.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        this.start('li').
          addClass(self.myClass('item')).
          addClass(self.myClass('level-' + heading.level)).
          start('a').
            attrs({ href: '#' + anchorId }).
            add(displayText).
          end().
        end();
      });
    }
  ]
});


foam.CLASS({package: 'foam.u2.markdown', name: 'H1', extends: 'foam.u2.markdown.Heading', properties: [ [ 'nodeName', 'h1' ], [ 'level', 1 ] ]});
foam.CLASS({package: 'foam.u2.markdown', name: 'H2', extends: 'foam.u2.markdown.Heading', properties: [ [ 'nodeName', 'h2' ], [ 'level', 2 ] ]});
foam.CLASS({package: 'foam.u2.markdown', name: 'H3', extends: 'foam.u2.markdown.Heading', properties: [ [ 'nodeName', 'h3' ], [ 'level', 3 ] ]});
foam.CLASS({package: 'foam.u2.markdown', name: 'H4', extends: 'foam.u2.markdown.Heading', properties: [ [ 'nodeName', 'h4' ], [ 'level', 4 ] ]});


foam.SCRIPT({
  package: 'foam.u2.markdown',
  name: 'TOCTagScript',

  documentation: 'Registers TOC-related custom elements for use in markdown/HTML documents.',

  code: function() {
    foam.__context__.registerElement(foam.u2.markdown.TOCConfig, 'tocconfig');
    foam.__context__.registerElement(foam.u2.markdown.TableOfContents, 'toc');
    foam.__context__.registerElement(foam.u2.markdown.H1);
    foam.__context__.registerElement(foam.u2.markdown.H2);
    foam.__context__.registerElement(foam.u2.markdown.H3);
    foam.__context__.registerElement(foam.u2.markdown.H4);
  }
});
