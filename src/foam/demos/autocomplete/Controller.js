foam.CLASS({
  package: 'foam.demos.autocomplete',
  name: 'AutoCompleter',

  documentation: `
    Usage:
      'query' is bound to the query string to be autocompleted
      Before 'query' is changed, the reset() method is called
      The query is parsed and apply() is passed to parseString() so the AutoCompleter
        can be informed of the parsing process.
      During the parseString(), apply() builds up the maps 'suggestions' and 'previousSuggestions'
        which are used to make suggestions.
      The render() method re-renders after query has changed to show updated suggestions.
      If the user clicks on a suggestion, it's output is appended to the query.
  `,

  properties: [
    {
      class: 'String',
      name: 'query'
    },
    {
      class: 'Int',
      name: 'maxPos'
    },
    {
      name: 'previousSuggestions'
    },
    {
      name: 'suggestions',
      factory: function() { return {}; }
    },
    {
      name: 'apply', // TODO: a better name
      factory: function() {
        var auto = this;

        function maybeAdd(p, ss) {
          try {
            if ( p.suggest ) {
              var s = p.suggest();
              if ( s ) {
                var label = s.text;
                if ( ! ss[label] ) {
                  ss[label] = s;
                }
              }
            }
          } catch(x) {}
        }

        return function(p, obj) {
          // 'this' is the PStream, TODO: pass ps as first param
          if ( p == foam.parse.EOF.create() ) return;
          if ( this.pos > auto.query.length ) return;

          if ( this.pos > auto.maxPos ) {
            auto.previousSuggestions = auto.suggestions;
            auto.suggestions = {};
            auto.maxPos = this.pos;
          }

          if ( this.pos == auto.maxPos ) {
            maybeAdd(p, auto.suggestions);
          } else if ( this.pos == auto.maxPos-1 ) {
            maybeAdd(p, auto.previousSuggestions);
          }

          return p.parse(this, obj);
        }
      }
    }
  ],

  methods: [
    function reset() {
      this.maxPos              = 0;
      this.previousSuggestions = {};
      this.suggestions         = {};
    },
    function suggestForInput(str) {
      var error = str.substring(this.maxPos);
      return Object.keys(this.suggestions).filter(k => k.startsWith(error)).join(' | ');
    },
    function toString() {
      return Object.keys(this.suggestions).join(' | ');
    },
    function addToE(e) {
      function containsIC(str, sub) {
        return str.toLowerCase().indexOf(sub.toLowerCase()) != -1;
      }
      var self = this;
      e.add(this.dynamic(function(query) {
        var suggestions = self.suggestions;
        var keys        = Object.keys(suggestions);
        var error       = query.substring(self.maxPos);
//        suggestions = {...suggestions, ...self.previousSuggestions};
        var ss          = keys.sort().filter(k => k.toLowerCase().startsWith(error.toLowerCase()));
                        if ( ! ss.length )        ss          = keys.sort().filter(k => containsIC(k, error));
        if ( ss.length == 0 ) {
          console.log('previous: ', self.previousSuggestions);
          keys = Object.keys(self.previousSuggestions);
          ss   = keys.sort().filter(k => query.toLowerCase().endsWith(k.toLowerCase()));
          console.log('filtered: ', ss);
          if ( ss.length == 1 ) {
            self.query = query.substring(0, query.length-ss[0].length) + ss[0];
            return;
          }
        }
        if ( ! ss.length ) return;
        if ( ss.length == 1 && self.maxPos + ss[0].length == query.length ) {
          self.query = self.query.substring(0, self.maxPos) + ss[0];
          return;
        }
        this.start().style({width: '400px', maxHeight: '500px', border: '1px solid gray', overflowY: 'auto'}).forEach(ss, function(s) {
          this.start('div').
            style({margin: '6px'}).
            add(s).
            on('click', function() { self.query = self.query.substring(0, self.maxPos) + s; }).
          end();
        });
      }));
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.autocomplete',
  name: 'Controller',
  extends: 'foam.u2.Controller',

  requires: [ 'foam.parse.QueryParser', 'foam.demos.autocomplete.AutoCompleter' ],

  properties: [
    {
      name: 'autoCompleter',
      factory: function() { return this.AutoCompleter.create({query$: this.query$}); }
    },
    {
      class: 'String',
      name: 'query',
      width: 120,
      onKey: true
    },
    {
      name: 'parser',
      factory: function() {
        return this.QueryParser.create({of: foam.core.auth.User});
//        return this.QueryParser.create({of: foam.util.Timer});
      }
    },
    {
      name: 'predicate',
      expression: function(query) {
        console.log(`****** parsing: "${query}"`);
        this.autoCompleter.reset();
        var ps = this.parser.parseString(query + String.fromCharCode(26) /* EOF */, undefined, this.autoCompleter.apply);
        console.log('autocomplete: ', this.autoCompleter.toString());
//        this.suggestion = this.autoCompleter.suggestForInput(this.query);
        return ps || null;
      }
    },
    {
      class: 'String',
      name: 'result',
      expression: function(predicate) {
        return predicate ? predicate.toString() : '';
      }
    },
    {
      class: 'String',
      name: 'suggestion'
    }
  ],

  methods: [
    function render() {
      this.add(this.QUERY.__);
      this.autoCompleter.addToE(this);
      this.br().add(this.result$);
//      this.add(this.SUGGESTION.__);
    }
  ]

});
