/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.auto',
  name: 'DateSuggester',
  extends: 'foam.u2.View',

  properties: [
    'suggestText',
    {
      class: 'Date',
      name: 'date',
      onKey: true
    }
  ],

  methods: [
    function render() {
      this.startContext({data: this}).add(this.DATE);
      this.date$.sub(() => {
        this.suggestText(this.date.toISOString().substring(0,10) + ' ');
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.parse.auto',
  name: 'DateTimeSuggester',
  extends: 'foam.u2.View',

  properties: [
    'suggestText',
    {
      class: 'DateTime',
      name: 'date',
      onKey: true
    }
  ],

  methods: [
    function render() {
      this.startContext({data: this}).add(this.DATE);
      this.date$.sub(() => {
        this.suggestText(this.date.toISOString() + ' ');
      });
    }
  ]
});

foam.CLASS({
  package: 'foam.parse.auto',
  name: 'ColorSuggester',
  extends: 'foam.u2.View',

  properties: [
    'suggestText',
    {
      class: 'Color',
      name: 'color',
      view: 'foam.u2.view.ColorPicker'
    }
  ],

  methods: [
    function render() {
      this.startContext({data: this})
      .start().addClass('p-semiBold').add(this.data.label).end()
      .tag(this.COLOR);
      this.color$.sub(() => {
        this.suggestText(this.color);
      });
    }
  ]
});

foam.CLASS({
  package: 'foam.parse.auto',
  name: 'CSSTokenSuggester',
  extends: 'foam.u2.View',

  properties: [
    'suggestText',
    {
      class: 'FObjectProperty',
      of: 'foam.u2.CSSToken',
      name: 'token'
    }
  ],

  methods: [
    function render() {
      this
        .startContext({ controllerMode: 'VIEW' })
        .on('click', () => {
          this.suggestText(this.token.name);
        })
        .tag(foam.u2.CitationView, { data: this.token });
    }
  ]
});

foam.CLASS({
  package: 'foam.parse.auto',
  name: 'SuggestionView',
  extends: 'foam.u2.View',

//  imports: [ 'suggestText' ],

  css: `
    ^ {
      color: $textDefault;
    }
    ^label {
      font-style: normal;
      font-weight: $font-medium;
      line-height: 1.71;
      margin: 0;
    }
    ^text {
      color: $textSecondary;
    }

    ^property { color: $green400; }
    ^operator { color: $orange400; }
    ^value    { color: $blue400; }
    ^format   { color: $grey400; }
  `,

  properties: [
    'suggestText'
  ],

  methods: [
    function render() {
      let self = this;
      let data = this.data;

      this.
        addClass().
        start().
          addClass(this.myClass('label')).
          callIfElse(data.tooltip,
            function() {
              this.start('span').style({fontStyle: 'italic', color: 'gray'}).add(data.tooltip).end();
            },
            function() {
              this.
                style({cursor: 'pointer'}).
                add(data.label || data.text);
              self.on('click', () => self.suggestText(data.text));
            }
          ).
          callIf(data.category,
            function() {
              this.start('i').addClass(self.myClass(data.category)).style({float: 'right', fontSize: 'smaller'}).add(data.category).end();
            }
          ).
        end();

      if ( data.label !== data.text ) {
        this.start().
          addClass(this.myClass('text')).
          add(data.text).
        end();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.parse.auto',
  name: 'SmartView', // TODO: rename GrammarView or SyntaxView
  extends: 'foam.u2.View',

  documentation: `
    A TextField which provides AutoComplete support.
    Works with any FOAM parser which makes suggestions.
    parser: must be supplied
  `,

  requires: [
    'foam.parse.SimpleQueryParser',
    'foam.parse.auto.SuggestionView',
    'foam.u2.TextField',
    'foam.u2.md.OverlayDropdown'
  ],

  imports: [
    'window'
  ],

  css: `
    ^suggestions {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 4px;
      overflow-y: auto;
      z-index: 1000;
    }
    ^suggestions > :not(^suggestionSeparator) {
      border-radius: 4px;
      padding: 4px 8px;
    }
    ^suggestions > :not(^suggestionSeparator):hover {
      background-color: $backgroundBrandTertiary;
      cursor: pointer;
    }
    ^suggestionSeparator { border-bottom: 1px solid $borderLight; }
  `,

  properties: [
    [ 'type', 'search' ],
    {
      class: 'String',
      name: 'preview',
      documentation: 'The input text bound onKey so that autoSuggest works even when onKey is false.',
      factory: function() {
        // Factory to data so initial value is preserved
        return this.data;
      }
    },
    {
      name: 'parser'
    },
    {
      class: 'Boolean',
      name: 'normalize',
      documentation: 'If true the input will be normalized to preferred syntax where options exist.'
    },
    {
      class: 'Int',
      name: 'maxPos',
      documentation: 'The maximum position that parsing reached for the current set of suggestions'
    },
    {
      name: 'suggestions',
      factory: function() { return {}; },
      documentation: 'Current suggestions as a map of string keys to Suggestion objects.'
    },
    'field',
    {
      class: 'FObjectProperty',
      of: 'foam.u2.Element',
      name: 'overlay_',
      factory: function() {
        return this.OverlayDropdown.create({
          closeOnLeave: false,
          // styled: false,
          parentEdgePadding: '4',
          lockToParentWidth: true
        });
      }
    },
    {
      name: 'apply',
      factory: function() {
        let self = this;

        // Maybe add a suggestion
        function maybeAdd(/* parser */ p) {
          try {
            if ( p.suggest ) {
              let s = p.suggest();
              if ( s ) {
                let label = s.tooltip || s.text;
                if ( ! self.suggestions[label] ) {
                  self.suggestions[label] = s;
                }
              }
            }
          } catch(x) {}
        }

        // return the function that will be passed to parseString
        // p is the parser
        // grammar with all the symbols
        return function(p, grammar) {
          // 'this' is the JSPStream

          if ( this.pos > self.maxPos ) {
            self.suggestions = {};
            self.maxPos      = this.pos;
          }

          if ( this.pos == self.maxPos ) maybeAdd(p);

          let result = p.parse(this, grammar);

          if ( self.normalize && result && p.suggest ) {
            let s = p.suggest();
            if ( ! s.text ) return result;
            let prevQuery = self.preview.substring(0, this.pos);
            self.normalizedQuery = prevQuery + s.text + self.preview.substring(this.substring(result).length+this.pos) ;
            if ( self.preview !== self.normalizedQuery ) self.preview = self.normalizedQuery;
          }

          return result;
        }
      }
    },
    'prop'
  ],

  methods: [
    function detach() {
      this.overlay_.remove();
      this.SUPER();
    },
    function render() {
      let self = this;

      // Recalculate suggestions when the preview text changes
      this.preview$.sub(this.onPreviewChange);

      if ( this.prop?.onKey ) {
        this.data$.linkFrom(this.preview$);
      }

      this.SUPER();
      this
        .addClass()
        .start(this.TextField, {
          data$: this.data$,
          autocomplete: false,
          autocorrect: false
        }, this.field$).
          on('blur', this.onBlur).
          call(function() {
            self.prop && this.fromProperty?.(self.prop);
            // The 'preview' Property is always bound like its onKey mode
            this.attrSlot(null, 'input').linkFrom(self.preview$);
          }).
        on('keydown', this.onKeyPress, true).
        end();

      this.field.on('focus', this.onPreviewChange);
      self.overlay_.parentEl = this.field.el_();
      self.overlay_.write();
      self.overlay_
        .start()
          .addClass(this.myClass('suggestions'))
          .add(this.dynamic(function (suggestions) {
            self.populateSuggestions(this, suggestions);
          }))
        .end();
    },

    function containsIC(str, sub) {
      return str.length != sub.length && str.toLowerCase().indexOf(sub.toLowerCase()) != -1;
    },

    function populateSuggestions(e, suggestions) {
      let self = this;

      function compare(k1, k2) {
        var o1 = self.suggestions[k1];
        var o2 = self.suggestions[k2];

        let c = foam.util.compare(o1.category, o2.category);
        if ( c ) return c;
        return foam.util.compare(o1.label || o1.text, o2.label || o2.text);
      }

      let preview = self.preview;
      let keys    = Object.keys(suggestions);
      let delta   = preview.substring(self.maxPos);
      let ss      = keys.sort(compare); // Sort by section then (label or text)

      if ( delta ) ss = ss.filter(k => this.containsIC(k, delta));

      let parent = e.parentNode;

      if ( ! ss.length ) { self.overlay_.close(); return; }
      self.overlay_.open();

      e.forEach(ss, function(s, i, a) {
          if ( i !== 0 ) this.start().addClass(self.myClass('suggestionSeparator')).end();
          let sug = self.suggestions[s];
          this.tag(sug.view || self.SuggestionView, {
            data: sug,
            suggestText: (text) => {
              self.suggestText.call(self, text, sug);
            }
          });
        });
   },

    function reset() {
      this.maxPos          = 0;
      this.suggestions     = {};
      this.normalizedQuery = '';
    },

    function suggestText(txt, sug) {
      let str = this.preview.substring(0, this.maxPos);
      // This causes issues when suggesting units like 'px' after numbers
      if ( sug.prependSpaceOnSelect ) str += ' ';
      this.preview = ( str + txt ).trimStart();
      this.field.focus();
    },
    function fromProperty(prop) {
      this.SUPER(prop);
      this.prop = prop;
    }
  ],

  listeners: [
    {
      name: 'onKeyPress',
      code: function(e) {
        if ( e.key === 'Escape' && Object.keys(this.suggestions).length ) {
          e.stopPropagation();
          e.preventDefault();
          this.reset();
          return;
        }
        if ( e.key !== 'Tab' ) return;

        let keys  = Object.keys(this.suggestions);
        let delta = this.preview.substring(this.maxPos);

        if ( delta ) keys = keys.filter(k => this.containsIC(k, delta));

        if ( keys.length == 1 ) {
          this.preview = this.preview.substring(0, this.maxPos) + keys[0];
          e.stopPropagation();
          e.preventDefault();
        } else {
          this.reset();
        }
      }
    },
    {
      name: 'onBlur',
      isMerged: true,
      delay: 250,
      code: function() {
        // Close the selections list when the user leaves the field (and descendents)
        if ( ! this.element_.parentNode.contains(document.activeElement) ) {
          this.reset();
          // Fire a manaual change event since this will not have fired if the user
          // never changed the text field value and only used the completer.
          let el = this.field.el_();
          let event = new Event('change', { bubbles: true });
          el.dispatchEvent(event);
        }
      }
    },
    {
      name: 'onPreviewChange',
      isFramed: true,
      code: function() {
        // Parse the preview text with our 'apply' callback so we can rebuilud
        // the suggestions map.
        this.reset();

        var ps = this.parser.parseString(
          this.preview + String.fromCharCode(26) /* EOF */,
          undefined,
          this.apply);

        return ps || null;
      }
    }
  ]
});
