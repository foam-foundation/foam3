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
    'foam.u2.TextField'
  ],

  imports: [
    'window'
  ],

  css: `
    ^suggestions {
      background: $backgroundDefault;
      border-radius: $inputBorderRadius;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 2px 8px 0 rgba(0, 0, 0, 0.16);
      margin-top: 4px;
      overflow-y: auto;
      position: absolute;
      padding: 6px;
      padding-top: 0;
      position: fixed;
      z-index: 1000;
    }
  `,

  properties: [
    [ 'type', 'search' ],
    {
      class: 'String',
      name: 'preview',
      documentation: 'The input text bound onKey so that autoSuggest works even when onKey is false.'
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
    }
  ],

  methods: [
    function render() {
      let self = this;

      // Recalculate suggestions when the preview text changes
      this.preview$.sub(this.onPreviewChange);

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
            // The 'preview' Property is always bound like its onKey mode
            this.attrSlot(null, 'input').linkFrom(self.preview$);
          }).
        on('keydown', this.onKeyPress, true).
        end().
        start().
          addClass(this.myClass('suggestions')).
          add(this.dynamic(function (suggestions) {
            self.populateSuggestions(this, suggestions);
          })).
        end();

      this.field.on('focus', this.onPreviewChange);
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

      if ( ! ss.length ) { parent.show(false); return; }
      parent.show(true);

      e.start().
        forEach(ss, function(s, i, a) {
          let sug = self.suggestions[s];

          this.start('div').
            style({margin: '6px'}).
            tag(sug.view || self.SuggestionView, {
              data: sug,
              suggestText: self.suggestText.bind(self)
            });

          if ( i != a.length-1 )
            this.start('hr').style({marginBottom: '-6px'});
        });


      setTimeout(() => self.setPosition(parent), 0);
   },

    function setPosition(e) {
      let screenWidth  = this.window.innerWidth;
      let domRect      = this.parentNode.el_().getBoundingClientRect();
      let screenHeight = this.window.innerHeight;
      let scrollY      = this.window.scrollY;
      let rectT        = this.field.el_().getBoundingClientRect();
      // var parentCheck  = this.parentEdgePadding > -1;

//      console.log('screenWidth:',screenWidth,'domRect:',domRect,'screenHeight:',screenHeight,'scrollY:',scrollY,'parentCheck:',parentCheck);
      if ( domRect.top - scrollY < screenHeight / 2 ) {
        e.style({maxHeight: (screenHeight-domRect.y-domRect.height-20) + 'px'});
      } else {
        e.style({maxHeight: (domRect.y-20-scrollY) + 'px'});
        let rect = e.el_().getBoundingClientRect();
        let rectT = this.field.el_().getBoundingClientRect();
        e.style({top: (domRect.y - rect.height - 10)+ 'px'});
      }

      e.style({width: rectT.width});

      // TODO: shift left if too close to the right edge
      /*
      if ( domRect.left > 3 * (screenWidth / 4) ) {
        this.left = 'auto';
        this.right = parentCheck ? screenWidth - domRect.right : screenWidth - this.x + 10;
      } else if (domRect.left < 75) {
        this.left = parentCheck ? domRect.left : this.x + 10;
        this.right = 'auto';
      } else {
        this.left = parentCheck ? domRect.left : this.x - 75;
        this.right = 'auto';
        }
      */
    },

    function reset() {
      this.maxPos          = 0;
      this.suggestions     = {};
      this.normalizedQuery = '';
    },

    function suggestText(txt) {
      let str = this.preview.substring(0, this.maxPos).trim();
      if ( ! str.endsWith('.') ) str += ' ';
      this.preview = ( str + txt ).trimStart();
      this.field.focus();
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
