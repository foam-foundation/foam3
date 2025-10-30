/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.auto',
  name: 'DateSuggester',
  extends: 'foam.u2.View',

  imports: [ 'suggestText' ],

  properties: [
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
  name: 'SuggestionView',
  extends: 'foam.u2.View',

  imports: [ 'suggestText' ],

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

    ^property { color: $green400; }
    ^operator { color: $red400; }
    ^value    { color: $blue400; }
  `,

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
                on('click', () => self.suggestText(data.text)).
                add(data.label || data.text);
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
          add(data.text).
        end();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.parse.auto',
  name: 'AutoCompleter',

  requires: [ 'foam.parse.auto.SuggestionView' ],

  exports: [ 'suggestText' ],

  documentation: `
    Usage:
      'query' is bound to the query string to be autocompleted
      Before 'query' is changed, the reset() method is called
      The query is parsed and apply() is passed to parseString() so the AutoCompleter
        can be informed of the parsing process.
      During the parseString(), apply() builds up the maps 'suggestions'
        which are used to make suggestions.
      The render() method re-renders after query has changed to show updated suggestions.
      If the user clicks on a suggestion, it's output is appended to the query.
  `,

  properties: [
    {
      class: 'String',
      name: 'autoQuery',
      postSet: function(o, n) {
        console.log('************* autoQueryUpdate', o,n);
        // this.reset();
      }
    },
    {
      class: 'String',
      name: 'normalizedQuery'
    },
    {
      class: 'Boolean',
      name: 'normalize'
    },
    {
      class: 'Int',
      name: 'maxPos'
    },
    'prevSuggestions',
    {
      name: 'suggestions',
      factory: function() { return {}; },
      postSet: function(o, n) { this.prevSuggestions = o;}
    },
    {
      name: 'apply',
      factory: function() {
        let self = this;

        function maybeAdd(p, ss) {
          try {
            if ( p.suggest ) {
              let s = p.suggest();
              if ( s ) {
                let label = s.tooltip || s.text;
                if ( ! ss[label] ) {
                  ss[label] = s;
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

           //console.log('parsing: ' + self.autoQuery + ' length ' + self.autoQuery.length );

          if ( this.pos > self.maxPos ) {
            self.suggestions = {};
            self.maxPos = this.pos;
          }

          if ( this.pos == self.maxPos ) {
            maybeAdd(p, self.suggestions);
          }

          let result = p.parse(this, grammar);


          if ( self.normalize && result && p.suggest ) {
            let s = p.suggest();
            if ( ! s.text ) return result;
            //console.log('suggestion for ' + this.substring(result) + '->' + s.text + ' at ' + this.pos);
            let prevQuery = self.autoQuery.substring(0, this.pos);
            self.normalizedQuery = prevQuery + s.text + self.autoQuery.substring(this.substring(result).length+this.pos) ;
            //console.log('--- normalized query ---: ' + self.normalizedQuery + ' length ' + self.normalizedQuery.length);
            if ( self.autoQuery !== self.normalizedQuery ) self.autoQuery = self.normalizedQuery;

          }

          return result;
        }
      }
    }
  ],

  methods: [
    function reset() {
      console.log('reset');
      this.maxPos          = 0;
      this.suggestions     = {};
      this.normalizedQuery = '';
    },

    function toString() {
      return Object.keys(this.suggestions).join(' | ');
    },

    function suggestText(txt) {
      let str = this.autoQuery.substring(0, this.maxPos).trim();
      if ( ! str.endsWith('.') ) str += ' ';
      this.autoQuery = ( str + txt ).trimStart();
    },

    function addToE(e) {
      function containsIC(str, sub) {
        return str.toLowerCase().indexOf(sub.toLowerCase()) != -1;
      }
      var self = this;
      e.add(this.dynamic(function(autoQuery) {; // re-render when query changes
        let keys  = Object.keys(self.suggestions);
        // if ( keys.length == 0 ) { keys = Object.keys(self.prevSuggestions); self.suggestions = self.prevSuggestions; }
        let delta = autoQuery.substring(self.maxPos);
        let ss    = keys.sort(function(k1, k2) {
          var o1 = self.suggestions[k1];
          var o2 = self.suggestions[k2];

          let c = foam.util.compare(o1.category, o2.category);
          if ( c ) return c;
          return foam.util.compare(o1.label || o1.text, o2.label || o2.text);
        });

        if ( delta ) ss = ss.filter(k => containsIC(k, delta));
        if ( ! ss.length ) return;

        this.start().style({width: '240px', maxHeight: '500px', border: '1px solid gray', overflowY: 'auto'}).forEach(ss, function(s, i, a) {
          let sug = self.suggestions[s];

          this.start('div').
            style({margin: '6px', fontSize: '0.7em'}).
            tag(sug.view || self.SuggestionView, {data: sug, suggestText: self.suggestText.bind(self)});

          if ( i != a.length-1 )
            this.start('hr').style({marginBottom: '-6px'});
        });
      }));
    }
  ]
});
