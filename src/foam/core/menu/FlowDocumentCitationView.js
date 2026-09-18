/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'FlowDocumentCitationView',
  extends: 'foam.u2.CitationView',
  documentation: `
    CitationView for rendering documentation/tutorial/demo flows as
    clickable cards that display their name, description, and keywords
  `,

  imports: [ 'routeTo' ],

  css: `
    ^ {
      background: $white;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 1px solid $borderLight;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 10rem;
      padding: 4px 8px 6px 8px;
      width: 330px;
      height: 200px;
      overflow: hidden;
      border-top-width: 4px;
      display: flex;
      flex-direction: column;
    }
    ^:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
    }
    ^title {
      color: $textDefault;
      font-size: large;
      font-weight: bold;
      padding: 4px;
      border-bottom: 2px solid $borderDefault;
      flex-shrink: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    ^description {
      color: $textTertiary;
      font-size: 14px;
      line-height: 20px;
      box-sizing: content-box;
      flex: 0 0 80px;
      padding: 8px 4px 0px;
      margin-bottom: 8px;
      min-height: 0;
      overflow: hidden;
      white-space: normal;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
      line-clamp: 4;
    }
    ^keywords {
      margin-top: auto;
      box-sizing: border-box;
      flex: 0 0 auto;
      max-height: 56px;
      overflow: hidden;
      padding: 4px;
    }
    ^keyword-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    ^keyword {
      color: $textTertiary;
      font-size: 12px;
      background-color: $grey100;
      padding: 2px 6px;
      border: 1px solid $grey100;
      border-radius: 10px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      line-height: 16px;
      max-width: 98px; /* When changing this value, ensure that the +N toggle still renders */
    }
    ^expanded {
      height: auto;
      min-height: 200px;
    }
    ^keywords-expanded {
      max-height: none;
    }
    ^toggle {
      cursor: pointer;
      font-weight: bold;
      background-color: $grey200;
      border-color: $grey200;
    }
    ^toggle:hover {
      background-color: $grey300;
      border-color: $grey300;
    }
  `,

  messages: [
    {
      name: 'NO_DESC_MSG',
      messageMap: { en: 'No description', fr: 'Pas de description' }
    },
    {
      name: 'SHOW_MORE_MSG',
      messageMap: { en: 'Show more', fr: 'Afficher plus' }
    },
    {
      name: 'SHOW_LESS_MSG',
      messageMap: { en: 'Show less', fr: 'Afficher moins' }
    }
  ],

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.reflow.Flow',
      name: 'data',
      documentation: 'A documentation, tutorial, or demo flow'
    },
    {
      class: 'Boolean',
      name: 'expanded',
      documentation: 'Toggle for expanding the list of keywords'
    },
    {
      class: 'Int',
      name: 'collapsedCount',
      value: 5,
      documentation: 'Number of keyword chips shown before the "+N more" toggle appears'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this
        .addClass(this.myClass())
        .enableClass(this.myClass('expanded'), this.expanded$)
        .attrs({ role: 'button', tabindex: 0 })
        .style({ // Change top of the cards based on the flow's category
          'border-top-color': 'hsl(' + this.stringToHue(this.data.category || '') + ', 80%, 45%)'
        })
        .on('click', this.routeToReflow) // Open flow in Reflow on click
        .on('keydown', function(e) {  // Also do it when you tab + enter
          if ( e.key === 'Enter' || e.key === ' ' ) self.routeToReflow(e);
        })
          .start() // Title
            .addClass(this.myClass('title'))
            .attrs({ title: this.data.name })
            .add(this.data.name)
          .end()
          .start() // Description
            .attrs({ title: this.data.name })
            .addClass(this.myClass('description')).add(this.data.description ? this.data.description : this.NO_DESC_MSG)

          .end()
          .start() // Keywords + Toggle Logic
            .addClass(this.myClass('keywords'))
            .enableClass(this.myClass('keywords-expanded'), this.expanded$)
            .add(this.slot(function(expanded, data$keywords) {
              var kw    = (data$keywords || []).filter(k => k !== 'knowledge'); // Filter out the knowledge keyword
              var shown = expanded ? kw : kw.slice(0, self.collapsedCount);
              return self.E()
                .addClass(self.myClass('keyword-list'))
                .forEach(shown, function(keyword) {
                  this.start()
                    .attrs({ title: keyword })
                    .addClass(self.myClass('keyword'))
                    .add(keyword)
                    .on('click', function(e) { self.addKeywordOnClick(e, keyword); })
                  .end();
                })
                .callIf(kw.length > self.collapsedCount, function() {
                  this.start()
                    .attrs({ title: expanded ? self.SHOW_LESS_MSG : self.SHOW_MORE_MSG })
                    .addClass(self.myClass('keyword'), self.myClass('toggle'))
                    .add(expanded ? self.SHOW_LESS_MSG : '+' + (kw.length - shown.length))
                    .on('click', self.toggleKeywords)
                  .end();
                });
            }))
          .end();
    },

    function stringToHue(str) {
      let hash = 0;
      
      // Hash the string using a simple djb2-like numeric accumulator
      for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      
      // Ensure the hash is positive and map it to a 0-360 degree angle
      return Math.abs(hash) % 360;
    }
  ],

  listeners: [
    function toggleKeywords(e) {
      e.preventDefault();
      e.stopPropagation();
      this.expanded = ! this.expanded;
    },

    function routeToReflow(e) {
      e.preventDefault();
      this.reflow();
    },

    function addKeywordOnClick(e, word) {
      e.preventDefault();
      e.stopPropagation();

      // Get the current search query
      var hash = window.location.hash;
      var i = hash.indexOf('search=');
      var ogQuery = i === -1 ? '' : decodeURIComponent(hash.slice(i + 'search='.length).split('&')[0]);
      var newQuery = ogQuery;

      if ( ogQuery.length == 0 ) { // If the search query is empty
        newQuery = "keywords IN (" + word + ")";

      } else if ( ogQuery.includes('keywords IN (') ) { // If the search query already has "keywords IN"
        var j     = ogQuery.indexOf('keywords IN (');
        var open  = j + 'keywords IN ('.length;
        var close = ogQuery.indexOf(')', open);

        if ( close === -1 ) {
          // Malformed — no closing paren. Leave the query alone.
          newQuery = ogQuery;
        } else {
          var terms = ogQuery.slice(open, close)
            .split(',')
            .map(t => t.trim())
            .filter(t => t);

          if ( ! terms.includes(word) ) {
            terms.push(word);
            newQuery = ogQuery.slice(0, open) +
                       terms.join(', ') +
                       ogQuery.slice(close);
          }
        }
      } else { // If the search query has non-keyword-related content
        newQuery = ogQuery + " OR keywords IN (" + word + ")"; // Append on the keyword query
      }

      if ( newQuery === ogQuery ) return; // Don't rebuild for no reason

      // Set the newQuery and push it to the URL, then route back to this menu
      var route = hash.replace(/^#/, '');          // "knowledgeBase?search=..."
      var qIdx  = route.indexOf('?');
      var menu  = qIdx === -1 ? route : route.slice(0, qIdx);

      this.routeTo(menu + '?search=' + encodeURIComponent(newQuery));
    }
  ],

  actions: [
    {
      name: 'reflow', // Taken from Flow.js
      code: function(X) {
        var mode = X.flowMode || X.config?.flowMode || 'PRESENTATION';
        X.routeTo('flow_/' + encodeURIComponent(this.data.name) + '?flowMode=' + mode);
      },
      isAvailable: function() {
        // Disable in Reflow, but enable in DAOController (because already in reflow)
        return ! this.__context__.flow;
      }
    }
  ]
});