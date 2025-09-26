foam.CLASS({
  package: 'foam.demos.queryparser',
  name: 'QueryComplete',

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
      name: 'query'
    },
    {
      class: 'Int',
      name: 'maxPos'
    },
    {
      name: 'suggestions',
      factory: function() { return {}; }
    },
    {
      name: 'apply', 
      factory: function() {
        let self = this;

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

        // return the function that will be passed to parseString
        // p is the parser
        // grammar with all the symbols
        return function(p, grammar) {
          // 'this' is the JSPStream
          
          if ( this.pos > self.maxPos ) {
            self.suggestions = {};
            self.maxPos = this.pos;
          }

          if ( this.pos == self.maxPos ) {
            maybeAdd(p, self.suggestions);
          } 

          return p.parse(this, grammar);
        }
      }
    }
  ],

  methods: [
    function reset() {
      this.maxPos              = 0;
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
        let suggestions = self.suggestions;
        let keys        = Object.keys(suggestions);
        let delta       = query.substring(self.maxPos);
        let ss          = keys.sort();

        if (delta) ss = ss.filter(k => containsIC(k, delta));
        if ( ! ss.length ) return;
        
        this.start().style({width: '400px', maxHeight: '500px', border: '1px solid gray', overflowY: 'auto'}).forEach(ss, function(s) {
          this.start('div').
            style({margin: '6px'}).
            add(s).
            on('click', function() { self.query = self.query.substring(0, self.maxPos) + s;}).
          end();
        });
      }));
    }
  ]
});


foam.CLASS({
  package: 'foam.demos.queryparser',
  name: 'QueryController',
  extends: 'foam.u2.Controller',

  requires: [ 'foam.parse.SimpleQueryParser', 'foam.demos.queryparser.QueryComplete' ],

  properties: [
    {
      name: 'autoCompleter',
      factory: function() { return this.QueryComplete.create({query$: this.query$}); }
    },
    {
      class: 'String',
      name: 'query',
      onKey: true,
      view: function(_, X) {
          let view = foam.u2.TextField.create();
          X.data.query$.sub(()=>view.focus());
          return view;
      }  
    },
    {
      name: 'parser',
      factory: function() {
        return this.SimpleQueryParser.create({of: foam.core.auth.User});
//        return this.QueryParser.create({of: foam.util.Timer});
      }
    },
    {
      name: 'predicate',
      expression: function(query) {
        this.autoCompleter.reset();
        let ps = this.parser.parseString( (!query) ? ' ': query + String.fromCharCode(26), undefined, this.autoCompleter.apply);
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
      this.br().add(this.RESULT.__);
    }
  ]

});
