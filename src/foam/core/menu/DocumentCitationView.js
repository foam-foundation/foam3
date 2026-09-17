/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'DocumentCitationView',
  extends: 'foam.u2.CitationView',
  documentation: `
    CitationView for rendering documentation/tutorial/demo flows as
    clickable cards that display their name, description, and keywords
  `,

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
      border-top-color: $blue300;
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

  listeners: [
    function toggleKeywords(e) {
      e.preventDefault();
      e.stopPropagation();
      this.expanded = ! this.expanded;
    }
  ],

  methods: [
    function render() {
      var self = this;
      this
        .addClass(this.myClass())
        .enableClass(this.myClass('expanded'), this.expanded$)
          .start() // Title
            .addClass(this.myClass('title'))
            .attrs({ title: this.data.name })
            .add(this.data.name)
          .end()
          .start() // Description
            .attrs({ title: this.data.name })
            .addClass(this.myClass('description')).add(this.data.description ? this.data.description : 'No description')
          .end()
          .start() // Keywords + Toggle Logic
            .addClass(this.myClass('keywords'))
            .enableClass(this.myClass('keywords-expanded'), this.expanded$)
            .add(this.slot(function(expanded, data$keywords) {
              var kw    = data$keywords || [];
              var shown = expanded ? kw : kw.slice(0, self.collapsedCount);
              return self.E()
                .addClass(self.myClass('keyword-list'))
                .forEach(shown, function(keyword) {
                  this.start()
                    .attrs({title: keyword})
                    .addClass(self.myClass('keyword'))
                    .add(keyword)
                  .end();
                })
                .callIf(kw.length > self.collapsedCount, function() {
                  this.start()
                    .attrs({ title: expanded ? 'Show less' : 'Show more'})
                    .addClass(self.myClass('keyword'), self.myClass('toggle'))
                    .add(expanded ? 'Show less' : '+' + (kw.length - shown.length))
                    .on('click', self.toggleKeywords)
                  .end();
                });
            }))
          .end();
    }
  ]
});